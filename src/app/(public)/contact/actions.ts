'use server';

import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { isValidPhoneNumber } from 'libphonenumber-js/mobile';
import {
  validateFullName,
  validateEmailAddress,
} from '@/lib/validations/contact-rules';
import { isFakePhone } from '@/lib/validations/phone';

declare global {
  // eslint-disable-next-line no-var
  var __travincoContactRateLimitMap: Map<string, number[]> | undefined;
}

function getSubmissionLog(): Map<string, number[]> {
  if (!globalThis.__travincoContactRateLimitMap) {
    globalThis.__travincoContactRateLimitMap = new Map();
  }
  return globalThis.__travincoContactRateLimitMap;
}

const contactSchema = z.object({
  name: z
    .string({ required_error: 'Enter valid full name' })
    .trim()
    .min(1, 'Enter valid full name')
    .max(120, 'Full name must be under 120 characters')
    .superRefine((val, ctx) => {
      const err = validateFullName(val);
      if (err) ctx.addIssue({ code: 'custom', message: err });
    }),
  phone: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .min(1, 'Phone number is required')
    .max(30)
    .refine((val) => isValidPhoneNumber(val) && !isFakePhone(val), {
      message: 'Please enter a valid phone number',
    }),
  whatsapp_number: z.string().max(30).optional().or(z.literal('')),
  email: z
    .string({ required_error: 'Please enter a valid email address' })
    .trim()
    .min(1, 'Please enter a valid email address')
    .superRefine((val, ctx) => {
      const err = validateEmailAddress(val);
      if (err) ctx.addIssue({ code: 'custom', message: err });
    }),
  subject: z
    .string({ required_error: 'Subject is required' })
    .trim()
    .min(1, 'Subject is required')
    .max(200),
  message: z
    .string({ required_error: 'Message is required' })
    .trim()
    .min(1, 'Message is required')
    // Inappropriate words are accepted and stored; staff screens mask them (maskBadWords)
    .max(2000),
  website: z.string().max(0).optional().or(z.literal('')), // honeypot
});

export type ContactFormState = { error?: string; success?: boolean };

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 3; // 3 attempts per 10 minutes

function checkRateLimit(key: string): { isLimited: boolean; retryAfterMinutes: number } {
  const now = Date.now();
  const log = getSubmissionLog();
  const timestamps = (log.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (timestamps.length >= RATE_LIMIT_MAX) {
    const oldest = timestamps[0] || (now - RATE_LIMIT_WINDOW_MS);
    const remainingMs = Math.max(0, RATE_LIMIT_WINDOW_MS - (now - oldest));
    const retryAfterMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
    return { isLimited: true, retryAfterMinutes };
  }

  return { isLimited: false, retryAfterMinutes: 0 };
}

function recordSubmission(key: string) {
  const now = Date.now();
  const log = getSubmissionLog();
  const timestamps = (log.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  log.set(key, timestamps);
}

export async function submitContactMessage(
  _prev: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const headersList = await headers();
  const rawIp =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headersList.get('x-real-ip')?.trim() ||
    'unknown';
  const rawEmail = String(formData.get('email') || '').trim().toLowerCase();
  const rateLimitKey = rawIp !== 'unknown' ? `ip:${rawIp}` : `email:${rawEmail || 'anon'}`;

  const { isLimited, retryAfterMinutes } = checkRateLimit(rateLimitKey);
  if (isLimited) {
    return {
      error: `Too many messages sent. You can send up to 3 messages every 10 minutes. Please try again in ${retryAfterMinutes} minute${
        retryAfterMinutes > 1 ? 's' : ''
      }.`,
    };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = contactSchema.safeParse(raw);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const message = firstIssue?.message ?? 'Please check the form and try again.';
    return { error: message };
  }

  // Count valid submission attempt towards rate limit
  recordSubmission(rateLimitKey);

  if (parsed.data.website) {
    return { success: true }; // honeypot tripped — pretend success, write nothing
  }

  const supabase = await createClient();

  // Written into the same enquiries table the enquiry/booking forms
  // use, so every way a visitor can reach out shows up together in
  // Admin -> Enquiries, rather than being split across two separate
  // places. The message is prefixed so staff can tell at a glance this
  // came from the Contact page rather than a package enquiry.
  const { error } = await supabase.from('enquiries').insert({
    customer_name: parsed.data.name,
    phone: parsed.data.phone,
    whatsapp_number: parsed.data.whatsapp_number || null,
    email: parsed.data.email || null,
    message: `[Contact form${parsed.data.subject ? ` — ${parsed.data.subject}` : ''}] ${parsed.data.message}`,
    source: 'other',
    status: 'new',
    priority: 'urgent',
    is_deleted: false,
  });

  if (error) {
    return { error: 'Something went wrong on our end. Please try again or WhatsApp us directly.' };
  }

  try {
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/travinco_dashboard/enquiries');
  } catch {
    // Best-effort
  }

  return { success: true };
}
