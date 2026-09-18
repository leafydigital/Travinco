'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { sendGmail, isGmailConfigured } from '@/lib/email/gmail';
import crypto from 'crypto';

const LINK_TTL_MINUTES = 30;

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Emails a one-click verification link for the given address and
 * stores the link's token hash (never the plain token) for later
 * verification. Used to confirm a visitor actually controls the email
 * they typed into the public enquiry/contact form, before it's
 * accepted — this is anti-abuse, not a login, and never touches
 * customer_accounts or profiles.
 *
 * Sent via Gmail SMTP (see lib/email/gmail.ts) rather than a third-party
 * API, since that's what's actually configured for this project.
 */
export async function sendEnquiryEmailOtp(email: string): Promise<{ error?: string }> {
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    return { error: 'Enter a valid email first.' };
  }

  if (!isGmailConfigured()) {
    return {
      error:
        'Email verification is not configured yet. Set GMAIL_USER and GMAIL_APP_PASSWORD to enable it.',
    };
  }

  const token = generateToken();
  const supabase = createServiceClient();

  const { error: insertError } = await supabase.from('enquiry_email_otps').insert({
    email: trimmedEmail,
    code_hash: hashToken(token),
    expires_at: new Date(Date.now() + LINK_TTL_MINUTES * 60 * 1000).toISOString(),
  });

  if (insertError) {
    return { error: 'Could not send the verification email. Please try again.' };
  }

  const verifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/verify-email?token=${token}&email=${encodeURIComponent(trimmedEmail)}`;

  const result = await sendGmail({
    to: trimmedEmail,
    subject: 'Confirm your email',
    html: `<p>Click the link below to confirm your email address:</p><p><a href="${verifyUrl}">Verify my email</a></p><p>This link expires in ${LINK_TTL_MINUTES} minutes. If you didn't request this, you can ignore it.</p>`,
  });

  if (result.error) {
    return { error: 'Could not send the verification email. Please try again.' };
  }

  return {};
}

/** Verifies a link's token against the most recent unverified request for that email. */
export async function verifyEnquiryEmailOtp(
  email: string,
  token: string
): Promise<{ error?: string; verified?: boolean }> {
  const trimmedEmail = email.trim().toLowerCase();
  const supabase = createServiceClient();

  const { data: record } = await supabase
    .from('enquiry_email_otps')
    .select('*')
    .eq('email', trimmedEmail)
    .is('verified_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!record) {
    return { error: 'No verification request found. Please request a new link.' };
  }
  if (new Date(record.expires_at) < new Date()) {
    return { error: 'This link has expired. Please request a new one.' };
  }
  if (record.attempts >= 5) {
    return { error: 'Too many attempts. Please request a new link.' };
  }

  if (hashToken(token.trim()) !== record.code_hash) {
    await supabase
      .from('enquiry_email_otps')
      .update({ attempts: record.attempts + 1 })
      .eq('id', record.id);
    return { error: 'This link is invalid.' };
  }

  await supabase
    .from('enquiry_email_otps')
    .update({ verified_at: new Date().toISOString() })
    .eq('id', record.id);

  return { verified: true };
}

/**
 * Lightweight, side-effect-free check used by the form's polling loop
 * to detect whether the link has been clicked yet, without consuming
 * an attempt or re-running verification logic.
 */
export async function checkEnquiryEmailVerified(email: string): Promise<boolean> {
  return wasEnquiryEmailRecentlyVerified(email);
}

/**
 * Called right before actually creating the enquiry — confirms this
 * email was verified recently (within the same link's TTL window), so
 * the enquiry-creation action can refuse to proceed for an email that
 * was never confirmed.
 */
export async function wasEnquiryEmailRecentlyVerified(email: string): Promise<boolean> {
  const trimmedEmail = email.trim().toLowerCase();
  const supabase = createServiceClient();

  const { data: record } = await supabase
    .from('enquiry_email_otps')
    .select('verified_at, expires_at')
    .eq('email', trimmedEmail)
    .not('verified_at', 'is', null)
    .order('verified_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!record || !record.verified_at) return false;
  return new Date(record.expires_at) > new Date();
}
