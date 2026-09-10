'use server';

import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().min(2, 'Please enter your name').max(120),
  phone: z.string().max(20).optional().or(z.literal('')),
  whatsapp_number: z.string().max(20).optional().or(z.literal('')),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  subject: z.string().max(200).optional().or(z.literal('')),
  message: z.string().min(5, 'Message is too short').max(2000),
  website: z.string().max(0).optional().or(z.literal('')), // honeypot
});

export type ContactFormState = { error?: string; success?: boolean };

const submissionLog = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

function isRateLimited(ip: string) {
  const now = Date.now();
  const timestamps = (submissionLog.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  submissionLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

export async function submitContactMessage(
  _prev: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  if (isRateLimited(ip)) {
    return { error: 'Too many messages sent. Please try again in a few minutes.' };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = contactSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form and try again.' };
  }

  if (parsed.data.website) {
    return { success: true }; // honeypot tripped — pretend success, write nothing
  }

  if (!parsed.data.phone && !parsed.data.email) {
    return { error: 'Please provide a phone number or email so we can reach you back.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('contact_messages').insert({
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    whatsapp_number: parsed.data.whatsapp_number || null,
    email: parsed.data.email || null,
    subject: parsed.data.subject || null,
    message: parsed.data.message,
    ip_address: ip !== 'unknown' ? ip : null,
  });

  if (error) {
    return { error: 'Something went wrong on our end. Please try again or WhatsApp us directly.' };
  }

  try {
    const { notifyAdminOfContactMessage } = await import('@/lib/email/notify');
    await notifyAdminOfContactMessage({ name: parsed.data.name, subject: parsed.data.subject || null });
  } catch {
    // Best-effort only — never fail the submission over email delivery.
  }

  return { success: true };
}
