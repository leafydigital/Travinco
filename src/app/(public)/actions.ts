'use server';

import { createCustomerClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getCustomer } from '@/lib/supabase/customer-auth-helpers';
import { enquiryFormSchema } from '@/lib/validations/enquiry';
import { sendEnquiryEmailOtp, verifyEnquiryEmailOtp } from '@/lib/enquiry-otp';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

export type EnquirySubmitState = {
  error?: string;
  success?: boolean;
  enquiryNumber?: string;
};

export type RequestEnquiryOtpResult = {
  error?: string;
  success?: boolean;
  email?: string;
};

export type VerifyEnquiryOtpResult = {
  error?: string;
  success?: boolean;
  enquiryNumber?: string;
};

// Simple in-memory rate limit: same IP can't submit more than 5 times in 10 minutes
const submissionLog = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

function isRateLimited(ip: string) {
  const now = Date.now();
  const timestamps = (submissionLog.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  timestamps.push(now);
  submissionLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

function computePriorityFromDate(travelDateStr?: string | null): 'urgent' | 'high' | 'medium' | 'low' {
  if (!travelDateStr) return 'urgent';
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const travel = new Date(travelDateStr);
    travel.setHours(0, 0, 0, 0);
    const diffTime = travel.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= 2) return 'urgent'; // today or upcoming within 48h
    if (diffDays <= 7) return 'high';   // within a week
    if (diffDays <= 30) return 'medium';
    return 'low';
  } catch {
    return 'urgent';
  }
}

/**
 * Step 1: Validates enquiry form fields and sends a 6-digit OTP to the provided email.
 */
export async function requestEnquiryOtp(formData: FormData): Promise<RequestEnquiryOtpResult> {
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  if (isRateLimited(ip)) {
    return { error: 'Too many requests. Please try again in a few minutes.' };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = enquiryFormSchema.safeParse(raw);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const fieldName = firstIssue?.path?.[0];
    const message = firstIssue?.message ?? 'Please check the form and try again.';
    return { error: fieldName ? `${fieldName}: ${message}` : message };
  }

  // Honeypot tripped — pretend success silently
  if (parsed.data.website) {
    return { success: true, email: parsed.data.email };
  }

  const sendResult = await sendEnquiryEmailOtp(parsed.data.email, parsed.data.customer_name);
  if (sendResult.error) {
    return { error: sendResult.error };
  }

  return { success: true, email: parsed.data.email };
}

/**
 * Step 2: Verifies the entered OTP and, upon success, creates and saves the enquiry.
 */
export async function verifyEnquiryOtpAndSubmit(
  formData: FormData,
  otp: string
): Promise<VerifyEnquiryOtpResult> {
  if (!otp || otp.trim().length !== 6) {
    return { error: 'Please enter the 6-digit verification code.' };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = enquiryFormSchema.safeParse(raw);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const fieldName = firstIssue?.path?.[0];
    const message = firstIssue?.message ?? 'Please check the form and try again.';
    return { error: fieldName ? `${fieldName}: ${message}` : message };
  }

  // Honeypot tripped — silently return success
  if (parsed.data.website) {
    return { success: true, enquiryNumber: 'ENQ-0000-00000' };
  }

  // Verify OTP strictly
  const verifyResult = await verifyEnquiryEmailOtp(parsed.data.email, otp.trim());
  if (verifyResult.error || !verifyResult.verified) {
    return { error: verifyResult.error || 'Invalid verification code.' };
  }

  // Check optional logged-in customer session
  const customer = await getCustomer();
  const serviceSupabase = createServiceClient();

  let customerId: string | null = null;
  const targetEmail = parsed.data.email.trim().toLowerCase();

  try {
    if (customer?.email) {
      const { data: cust } = await serviceSupabase
        .from('customers')
        .select('id')
        .eq('email', customer.email.trim().toLowerCase())
        .maybeSingle();
      customerId = cust?.id ?? null;
    }

    if (!customerId) {
      const { data: existingCust } = await serviceSupabase
        .from('customers')
        .select('id')
        .eq('email', targetEmail)
        .maybeSingle();

      if (existingCust) {
        customerId = existingCust.id;
      } else {
        // Create customer record so team can view and reach out
        const { data: newCust } = await serviceSupabase
          .from('customers')
          .insert({
            full_name: parsed.data.customer_name,
            email: targetEmail,
            phone: parsed.data.phone,
            source: 'website',
            is_active: true,
            is_deleted: false,
          } as any)
          .select('id')
          .maybeSingle();

        customerId = newCust?.id ?? null;
      }
    }
  } catch (custErr) {
    console.warn('Could not associate customer record:', custErr);
  }

  const initialPriority = computePriorityFromDate(parsed.data.travel_date);
  let enquiryNumber = `ENQ-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

  const payload = {
    customer_id: customerId,
    customer_name: parsed.data.customer_name,
    phone: parsed.data.phone,
    whatsapp_number: parsed.data.whatsapp_number || null,
    email: targetEmail,
    package_id: parsed.data.package_id || null,
    destination: parsed.data.destination || null,
    travel_date: parsed.data.travel_date || null,
    number_of_adults: parsed.data.number_of_adults,
    number_of_children: parsed.data.number_of_children,
    number_of_infants: parsed.data.number_of_infants,
    budget: parsed.data.budget || null,
    message: parsed.data.message || null,
    source: 'website' as const,
    status: 'new' as const,
    priority: initialPriority,
    is_deleted: false,
  };

  let insertData: any = null;
  let insertError: any = null;

  try {
    const res = await serviceSupabase
      .from('enquiries')
      .insert(payload)
      .select('enquiry_number')
      .maybeSingle();
    insertData = res.data;
    insertError = res.error;
  } catch (err: any) {
    insertError = err;
  }

  if (insertError) {
    console.warn('serviceSupabase insert failed, attempting fallback to customer client:', insertError);
    try {
      const customerSupabase = await createCustomerClient();
      const { data: fbData, error: fbError } = await customerSupabase
        .from('enquiries')
        .insert(payload)
        .select('enquiry_number')
        .maybeSingle();

      if (fbError) {
        console.error('Customer client fallback insert error:', fbError);
        return { error: 'Failed to save enquiry. Please try again or reach out to us on WhatsApp.' };
      }
      insertData = fbData;
    } catch (fbErr) {
      console.error('Customer client fallback caught error:', fbErr);
      return { error: 'Failed to save enquiry. Please try again or reach out to us on WhatsApp.' };
    }
  }

  if (insertData?.enquiry_number) {
    enquiryNumber = insertData.enquiry_number;
  }

  revalidatePath('/travinco_dashboard/enquiries');
  return { success: true, enquiryNumber };
}

/**
 * Backward-compatible wrapper for standard form submissions if called directly.
 */
export async function submitEnquiry(
  _prev: EnquirySubmitState,
  formData: FormData
): Promise<EnquirySubmitState> {
  const otp = formData.get('otp')?.toString() || '';
  if (!otp) {
    const reqResult = await requestEnquiryOtp(formData);
    if (reqResult.error) return { error: reqResult.error };
    return { error: 'Please verify the OTP code sent to your email.' };
  }

  return verifyEnquiryOtpAndSubmit(formData, otp);
}
