'use server';

import { createCustomerClient } from '@/lib/supabase/server';
import { getCustomer } from '@/lib/supabase/customer-auth-helpers';
import { enquiryFormSchema } from '@/lib/validations/enquiry';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

export type EnquirySubmitState = {
  error?: string;
  success?: boolean;
  enquiryNumber?: string;
};

// Simple in-memory rate limit: same IP can't submit more than 3 times in
// 10 minutes. This resets on server restart / doesn't share state across
// serverless instances — adequate as a first line of defense for a small
// agency site, but a real deployment on serverless infra should move this
// to a shared store (Upstash Redis, Supabase table) if abuse becomes an
// issue.
const submissionLog = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

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

export async function submitEnquiry(
  _prev: EnquirySubmitState,
  formData: FormData
): Promise<EnquirySubmitState> {
  const customer = await getCustomer();
  if (!customer) {
    return { error: 'Please log in to your customer account before submitting a request.' };
  }

  const supabase = await createCustomerClient();

  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  if (isRateLimited(ip)) {
    return { error: 'Too many submissions. Please try again in a few minutes.' };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = enquiryFormSchema.safeParse(raw);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const fieldName = firstIssue?.path?.[0];
    const message = firstIssue?.message ?? 'Please check the form and try again.';
    return { error: fieldName ? `${fieldName}: ${message}` : message };
  }

  // Honeypot tripped — silently pretend success so bots don't learn to
  // adapt, without actually writing spam to the database.
  if (parsed.data.website) {
    return { success: true, enquiryNumber: 'ENQ-0000-00000' };
  }

  // Uses the authenticated client and RPC function.
  // Falls back gracefully so enquiry submissions never fail even if service-role keys are missing.
  const initialPriority = computePriorityFromDate(parsed.data.travel_date);
  let enquiryNumber = `ENQ-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
  let insertedSuccessfully = false;

  // 1. Try the security-definer RPC function first
  const { data: rpcNumber, error: rpcError } = await supabase.rpc('submit_customer_enquiry', {
    p_customer_name: parsed.data.customer_name,
    p_phone: parsed.data.phone,
    p_whatsapp_number: parsed.data.whatsapp_number || null,
    p_email: parsed.data.email || customer.email || null,
    p_package_id: parsed.data.package_id || null,
    p_destination: parsed.data.destination || null,
    p_travel_date: parsed.data.travel_date || null,
    p_number_of_adults: parsed.data.number_of_adults,
    p_number_of_children: parsed.data.number_of_children,
    p_number_of_infants: parsed.data.number_of_infants,
    p_budget: parsed.data.budget || null,
    p_message: parsed.data.message || null,
    p_priority: initialPriority,
  });

  if (!rpcError && rpcNumber) {
    enquiryNumber = rpcNumber;
    insertedSuccessfully = true;
  } else {
    // 2. Direct client insert using the standard user/session client
    let customerId: string | null = null;
    if (customer.email) {
      const { data: cust } = await supabase
        .from('customers')
        .select('id')
        .eq('email', customer.email)
        .maybeSingle();
      customerId = cust?.id ?? null;
    }

    const payload = {
      customer_id: customerId,
      customer_name: parsed.data.customer_name,
      phone: parsed.data.phone,
      whatsapp_number: parsed.data.whatsapp_number || null,
      email: parsed.data.email || customer.email || null,
      package_id: parsed.data.package_id || null,
      destination: parsed.data.destination || null,
      travel_date: parsed.data.travel_date || null,
      number_of_adults: parsed.data.number_of_adults,
      number_of_children: parsed.data.number_of_children,
      number_of_infants: parsed.data.number_of_infants,
      budget: parsed.data.budget || null,
      message: parsed.data.message || null,
      source: 'website' as const,
      status: 'new' as const, // Pending
      priority: initialPriority,
      is_deleted: false,
    };

    // Try direct insert with select
    const { data: directData, error: directError } = await supabase
      .from('enquiries')
      .insert(payload)
      .select('enquiry_number')
      .maybeSingle();

    if (!directError && directData?.enquiry_number) {
      enquiryNumber = directData.enquiry_number;
      insertedSuccessfully = true;
    } else {
      // If select failed (RLS on read-back), do direct insert without select
      const { error: rawInsertError } = await supabase
        .from('enquiries')
        .insert(payload);

      if (!rawInsertError) {
        insertedSuccessfully = true;
      } else {
        console.error('submitEnquiry direct insert failed:', rawInsertError.message, rawInsertError.code);
        return { error: 'Something went wrong on our end. Please try again or WhatsApp us directly.' };
      }
    }
  }

  if (!insertedSuccessfully) {
    return { error: 'Something went wrong on our end. Please try again or WhatsApp us directly.' };
  }

  revalidatePath('/travinco_dashboard/enquiries');
  return { success: true, enquiryNumber };
}
