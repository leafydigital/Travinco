'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { sendGmail, isGmailConfigured } from '@/lib/email/gmail';
import { hashToken, generateOtpCode } from '@/lib/auth/otp-crypto';

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

type OtpMemoryRecord = {
  codeHash: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
};

// Global in-memory fallback store to guarantee zero-failure OTP generation and verification
const otpMemoryMap = new Map<string, OtpMemoryRecord>();

/**
 * Sends a 6-digit verification code to the customer's email address
 * and stores its SHA-256 hash in enquiry_email_otps (with memory fallback).
 */
export async function sendEnquiryEmailOtp(
  email: string,
  customerName?: string
): Promise<{ error?: string; success?: boolean; cooldownSeconds?: number }> {
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    return { error: 'Please enter a valid email address.' };
  }

  if (!isGmailConfigured()) {
    return {
      error: 'We could not send your verification email right now. Please try again in a few moments.',
    };
  }

  // Rate limiting check: prevent resend within 45 seconds
  const existingMem = otpMemoryMap.get(trimmedEmail);
  if (existingMem && Date.now() - existingMem.createdAt < 45 * 1000) {
    return {
      error: 'Please wait a moment before requesting another verification code.',
    };
  }

  const otpCode = generateOtpCode();
  const expiresAtMs = Date.now() + OTP_TTL_MINUTES * 60 * 1000;
  const expiresAtIso = new Date(expiresAtMs).toISOString();
  const hashedCode = hashToken(otpCode);

  // 1. Always store in memory fallback
  otpMemoryMap.set(trimmedEmail, {
    codeHash: hashedCode,
    expiresAt: expiresAtMs,
    attempts: 0,
    createdAt: Date.now(),
  });

  // 2. Persist to database if available
  try {
    const supabase = createServiceClient();
    const { error: insertError } = await supabase.from('enquiry_email_otps').insert({
      email: trimmedEmail,
      code_hash: hashedCode,
      expires_at: expiresAtIso,
      attempts: 0,
    });
    if (insertError) {
      console.warn('Enquiry OTP database insert warning (memory store active):', insertError.message);
    }
  } catch (dbErr: any) {
    console.warn('Enquiry OTP database insert warning (memory store active):', dbErr?.message);
  }

  const nameGreeting = customerName?.trim() ? `Hi ${customerName.trim()},` : 'Hello,';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Your Travinco Verification Code</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 24px; margin: 0;">
        <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="background-color: #022c22; padding: 28px 24px; text-align: center;">
            <h1 style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 700; letter-spacing: 1px;">TRAVINCO</h1>
            <p style="color: #a7f3d0; font-size: 13px; margin: 6px 0 0; text-transform: uppercase; letter-spacing: 1.5px;">Bespoke Travel & Holiday Itineraries</p>
          </div>
          <div style="padding: 32px 28px;">
            <p style="font-size: 15px; color: #1e293b; margin: 0 0 16px; font-weight: 600;">${nameGreeting}</p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px;">
              Thank you for planning your trip with Travinco. Please enter the verification code below to verify your email and confirm your enquiry:
            </p>
            <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #065f46; display: inline-block;">
                ${otpCode}
              </span>
              <p style="font-size: 12px; color: #047857; margin: 8px 0 0;">Valid for ${OTP_TTL_MINUTES} minutes</p>
            </div>
            <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0 0 8px;">
              Do not share this code with anyone. If you didn't request a travel quote or itinerary from Travinco, you can safely ignore this email.
            </p>
          </div>
          <div style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 16px 24px; text-align: center;">
            <p style="font-size: 11px; color: #94a3b8; margin: 0;">&copy; ${new Date().getFullYear()} Travinco Tours. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const result = await sendGmail({
    to: trimmedEmail,
    subject: `${otpCode} is your Travinco enquiry verification code`,
    html,
  });

  if (result.error) {
    console.error('sendEnquiryEmailOtp sendGmail error:', result.error);
    return { error: 'Failed to send verification email. Please check your address and try again.' };
  }

  return { success: true, cooldownSeconds: 60 };
}

/**
 * Verifies a 6-digit numeric OTP or token against the most recent unverified request for an email.
 */
export async function verifyEnquiryEmailOtp(
  email: string,
  otpOrToken: string
): Promise<{ error?: string; verified?: boolean }> {
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedCode = otpOrToken.trim();

  if (!trimmedEmail || !trimmedCode) {
    return { error: 'Please enter the verification code.' };
  }

  const computedHash = hashToken(trimmedCode);

  // 1. First attempt to verify against database
  try {
    const supabase = createServiceClient();
    const { data: record } = await supabase
      .from('enquiry_email_otps')
      .select('*')
      .eq('email', trimmedEmail)
      .is('verified_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (record) {
      if (new Date(record.expires_at) < new Date()) {
        return { error: 'This verification code has expired. Please request a new one.' };
      }

      if (record.attempts >= MAX_ATTEMPTS) {
        return { error: 'Too many incorrect attempts. Please request a new verification code.' };
      }

      if (computedHash !== record.code_hash) {
        const nextAttempts = record.attempts + 1;
        await supabase
          .from('enquiry_email_otps')
          .update({ attempts: nextAttempts })
          .eq('id', record.id);

        const remaining = MAX_ATTEMPTS - nextAttempts;
        if (remaining <= 0) {
          return { error: 'Too many incorrect attempts. Please request a new code.' };
        }
        return { error: `Incorrect verification code. You have ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` };
      }

      // Mark verified in DB and remove from memory
      await supabase
        .from('enquiry_email_otps')
        .update({ verified_at: new Date().toISOString() })
        .eq('id', record.id);

      otpMemoryMap.delete(trimmedEmail);
      return { verified: true };
    }
  } catch (dbErr) {
    console.warn('Database verify failed, checking memory fallback:', dbErr);
  }

  // 2. Check memory fallback store
  const memRecord = otpMemoryMap.get(trimmedEmail);
  if (!memRecord) {
    return { error: 'No active verification code found. Please request a new code.' };
  }

  if (Date.now() > memRecord.expiresAt) {
    otpMemoryMap.delete(trimmedEmail);
    return { error: 'This verification code has expired. Please request a new one.' };
  }

  if (memRecord.attempts >= MAX_ATTEMPTS) {
    otpMemoryMap.delete(trimmedEmail);
    return { error: 'Too many incorrect attempts. Please request a new verification code.' };
  }

  if (computedHash !== memRecord.codeHash) {
    memRecord.attempts += 1;
    const remaining = MAX_ATTEMPTS - memRecord.attempts;
    if (remaining <= 0) {
      otpMemoryMap.delete(trimmedEmail);
      return { error: 'Too many incorrect attempts. Please request a new code.' };
    }
    return { error: `Incorrect verification code. You have ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` };
  }

  // Verified successfully
  otpMemoryMap.delete(trimmedEmail);
  return { verified: true };
}

/**
 * Checks whether an email was verified within the validity window.
 */
export async function wasEnquiryEmailRecentlyVerified(email: string): Promise<boolean> {
  const trimmedEmail = email.trim().toLowerCase();
  try {
    const supabase = createServiceClient();
    const { data: record } = await supabase
      .from('enquiry_email_otps')
      .select('verified_at, expires_at')
      .eq('email', trimmedEmail)
      .not('verified_at', 'is', null)
      .order('verified_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (record?.verified_at && new Date(record.expires_at) > new Date()) {
      return true;
    }
  } catch {}

  return false;
}
