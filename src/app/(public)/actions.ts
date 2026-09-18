'use server';

import { createClient } from '@/lib/supabase/server';
import { enquiryFormSchema } from '@/lib/validations/enquiry';
import { headers } from 'next/headers';
import { wasEnquiryEmailRecentlyVerified } from '@/lib/enquiry-otp';

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

export async function submitEnquiry(
  _prev: EnquirySubmitState,
  formData: FormData
): Promise<EnquirySubmitState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Please log in to your account before submitting a request.' };
  }

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

  // If an email was given, it must have been verified via the OTP flow
  // just before submitting — this is the actual enforcement point; the
  // OTP UI alone is decorative without this check.
  if (parsed.data.email) {
    const verified = await wasEnquiryEmailRecentlyVerified(parsed.data.email);
    if (!verified) {
      return { error: 'Please verify your email before submitting.' };
    }
  }

  const { data, error } = await supabase
    .from('enquiries')
    .insert({
      customer_name: parsed.data.customer_name,
      phone: parsed.data.phone,
      whatsapp_number: parsed.data.whatsapp_number || null,
      email: parsed.data.email || null,
      package_id: parsed.data.package_id || null,
      destination: parsed.data.destination || null,
      travel_date: parsed.data.travel_date || null,
      number_of_adults: parsed.data.number_of_adults,
      number_of_children: parsed.data.number_of_children,
      number_of_infants: parsed.data.number_of_infants,
      budget: parsed.data.budget || null,
      message: parsed.data.message || null,
      source: 'website',
      status: 'new',
      priority: 'medium',
    })
    .select('enquiry_number')
    .single();

  if (error || !data) {
    // Never leak raw database errors to a public form.
    return { error: 'Something went wrong on our end. Please try again or WhatsApp us directly.' };
  }

  // Best-effort admin notification. Failure here must never fail the
  // enquiry submission itself — the database row is already the source
  // of truth per the CRM requirement; email is additive only.
  try {
    const { notifyAdminOfEnquiry } = await import('@/lib/email/notify');
    await notifyAdminOfEnquiry({
      enquiryNumber: data.enquiry_number,
      customerName: parsed.data.customer_name,
      phone: parsed.data.phone,
    });
  } catch {
    // Swallow — logged server-side by the email module itself if needed.
  }

  return { success: true, enquiryNumber: data.enquiry_number };
}
