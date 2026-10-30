import 'server-only';
import { randomUUID } from 'crypto';
import { escapeLike } from '@/lib/auth/signup-rules';
import { createServiceClient } from '@/lib/supabase/service';
import { sendGmail } from '@/lib/email/gmail';
import { clearLoginAttempts } from '@/lib/auth/login-limiter';
import {
  hashToken,
  generateOtpCode,
  encryptTicket,
  decryptTicket,
  maskEmail,
} from '@/lib/auth/otp-crypto';
import { getCustomerAccountStatus, accountStatusMessage } from '@/lib/auth/account-status';
import { z } from 'zod';

/**
 * Email-OTP password flows.
 *
 * Forgot password (customer /account/login and staff /app):
 *   1. email  -> account must exist and be active -> 6-digit code emailed
 *   2. code   -> verified -> short-lived "verified" ticket
 *   3. new password + confirm (with the verified ticket) -> saved
 *
 * Update password (signed-in customer, see account actions):
 *   current + new + confirm -> current verified -> code emailed -> code -> saved
 *
 * Tickets are AES-GCM encrypted (otp-crypto) so they can travel through the browser
 * without exposing the code hash, the email or a pending password.
 */

const OTP_TTL_MINUTES = 10;
const VERIFIED_TTL_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 45 * 1000;

export type ResetScope = 'customer' | 'staff' | 'change';

type OtpMemoryRecord = {
  codeHash: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
};

// Global memory cache across requests (survives HMR in local dev)
declare global {
  // eslint-disable-next-line no-var
  var __travincoPasswordOtpMemoryMap: Map<string, OtpMemoryRecord> | undefined;
  // eslint-disable-next-line no-var
  var __travincoUsedResetTickets: Map<string, number> | undefined;
}

function getMemoryMap(): Map<string, OtpMemoryRecord> {
  if (!globalThis.__travincoPasswordOtpMemoryMap) {
    globalThis.__travincoPasswordOtpMemoryMap = new Map();
  }
  return globalThis.__travincoPasswordOtpMemoryMap;
}

function getUsedTickets(): Map<string, number> {
  if (!globalThis.__travincoUsedResetTickets) {
    globalThis.__travincoUsedResetTickets = new Map();
  }
  const used = globalThis.__travincoUsedResetTickets;
  const now = Date.now();
  used.forEach((exp, id) => {
    if (exp < now) used.delete(id);
  });
  return used;
}

const memKey = (scope: ResetScope, email: string) => `${scope}:${email}`;

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(7, 'Password must be at least 7 characters')
      .regex(/[A-Z]/, 'Password must include at least one capital letter')
      .regex(/[a-z]/, 'Password must include at least one lowercase letter')
      .regex(/[0-9]/, 'Password must include at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must include at least one symbol'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type CheckEmailResult = {
  success: boolean;
  error?: string;
  email?: string;
  fullName?: string;
};

export type SendResetOtpResult = {
  success: boolean;
  error?: string;
  resetTicket?: string;
  maskedEmail?: string;
};

export type VerifyResetOtpResult = {
  success?: boolean;
  error?: string;
  verifiedTicket?: string;
};

export type SaveResetPasswordResult = {
  success?: boolean;
  error?: string;
};

/**
 * Step 1: Checks if customer email exists in the database.
 * Does NOT send an OTP yet — only verifies account presence in DB.
 */
export async function checkCustomerEmailExists(
  emailInput: string
): Promise<CheckEmailResult> {
  const trimmed = emailInput.trim();
  if (!trimmed) {
    return { success: false, error: 'Please enter your email address or username.' };
  }

  const serviceSupabase = createServiceClient();
  let targetEmail = trimmed.toLowerCase();
  let foundUser: { id?: string; email: string; fullName: string } | null = null;

  // If input is a username (no @), resolve to their registered email first
  if (!trimmed.includes('@')) {
    try {
      const { data: accountRow } = await serviceSupabase
        .from('customer_accounts')
        .select('id, full_name, email, username')
        .ilike('username', escapeLike(trimmed))
        .maybeSingle();

      if (accountRow?.email) {
        targetEmail = accountRow.email.toLowerCase();
        foundUser = {
          id: accountRow.id,
          email: targetEmail,
          fullName: accountRow.full_name || targetEmail.split('@')[0] || 'Traveler',
        };
      }
    } catch (uErr) {
      console.warn('Username check notice in reset:', uErr);
    }

    if (!foundUser) {
      try {
        const { data: usersData } = await serviceSupabase.auth.admin.listUsers({ perPage: 1000 });
        const authUser = usersData?.users?.find(
          (u) =>
            (u.user_metadata?.username as string)?.toLowerCase() === trimmed.toLowerCase()
        );
        if (authUser?.email) {
          targetEmail = authUser.email.toLowerCase();
          foundUser = {
            id: authUser.id,
            email: targetEmail,
            fullName:
              (authUser.user_metadata?.full_name as string) ||
              targetEmail.split('@')[0] ||
              'Traveler',
          };
        }
      } catch (authErr) {
        console.warn('Auth admin username check notice in reset:', authErr);
      }
    }

    if (!foundUser) {
      return {
        success: false,
        error: 'No customer account found with this username.',
      };
    }
  }

  // A. Check customer_accounts by email
  if (!foundUser) {
    try {
      const { data: accountRow } = await serviceSupabase
        .from('customer_accounts')
        .select('id, full_name, email')
        .ilike('email', targetEmail)
        .maybeSingle();

      if (accountRow) {
        foundUser = {
          id: accountRow.id,
          email: accountRow.email || targetEmail,
          fullName: accountRow.full_name || targetEmail.split('@')[0] || 'Traveler',
        };
      }
    } catch (err) {
      console.warn('customer_accounts lookup notice:', err);
    }
  }

  // B. Check customers table by email
  if (!foundUser) {
    try {
      const { data: customerRow } = await serviceSupabase
        .from('customers')
        .select('id, full_name, email, is_active, is_deleted')
        .ilike('email', targetEmail)
        .maybeSingle();

      if (customerRow) {
        foundUser = {
          id: customerRow.id,
          email: customerRow.email || targetEmail,
          fullName: customerRow.full_name || targetEmail.split('@')[0] || 'Traveler',
        };
      }
    } catch (err) {
      console.warn('customers table lookup notice:', err);
    }
  }

  // C. Check Supabase Auth users via admin API
  if (!foundUser) {
    try {
      const { data: usersData, error: listError } = await serviceSupabase.auth.admin.listUsers({ perPage: 1000 });
      if (!listError && usersData?.users) {
        const authUser = usersData.users.find(
          (u) => u.email?.toLowerCase() === targetEmail
        );
        if (authUser) {
          foundUser = {
            id: authUser.id,
            email: authUser.email || targetEmail,
            fullName:
              (authUser.user_metadata?.full_name as string) || targetEmail.split('@')[0] || 'Traveler',
          };
        }
      }
    } catch (err) {
      console.warn('auth.admin.listUsers lookup notice:', err);
    }
  }

  // If not found in DB
  if (!foundUser) {
    return {
      success: false,
      error: 'No customer account found with this email address or username.',
    };
  }

  // Staff accounts recover their password on the staff sign-in page (/app)
  try {
    const [{ data: staffRows }, { data: accountRows }] = await Promise.all([
      serviceSupabase.from('profiles').select('id').ilike('email', escapeLike(targetEmail)).limit(1),
      serviceSupabase.from('customer_accounts').select('id').ilike('email', escapeLike(targetEmail)).limit(1),
    ]);
    if (staffRows?.length && !accountRows?.length) {
      return { success: false, error: 'No customer account found with this email address or username.' };
    }
  } catch {
    // Lookup failure is not fatal; the emailed code still proves mailbox ownership
  }

  // Deactivated / deleted customers cannot recover a password (same rule as sign-in)
  const blocked = accountStatusMessage(await getCustomerAccountStatus(targetEmail));
  if (blocked) return { success: false, error: blocked };

  return {
    success: true,
    email: targetEmail,
    fullName: foundUser.fullName,
  };
}

// ─── Shared OTP core ──────────────────────────────────────────────────────────

type OtpTicket = {
  purpose: 'otp';
  scope: ResetScope;
  email: string;
  codeHash: string;
  exp: number;
  /** Extra data carried to the verify step (e.g. the pending password for "change"). */
  data?: Record<string, string>;
};

type VerifiedTicket = {
  purpose: 'verified';
  scope: ResetScope;
  email: string;
  id: string;
  exp: number;
};

const EMAIL_COPY: Record<ResetScope, { title: string; intro: string; subject: string }> = {
  customer: {
    title: 'Password Reset Verification',
    intro:
      'You have requested to reset the password for your Travinco account. Enter the 6-digit code below to verify it is you, then choose your new password.',
    subject: 'is your Travinco password reset code',
  },
  staff: {
    title: 'Team Password Reset',
    intro:
      'A password reset was requested for your Travinco team account. Enter the 6-digit code below to verify it is you, then choose your new password.',
    subject: 'is your Travinco team password reset code',
  },
  change: {
    title: 'Confirm Password Update',
    intro:
      'You asked to update the password for your Travinco account. Enter the 6-digit code below to confirm and save your new password.',
    subject: 'is your Travinco password update code',
  },
};

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

function otpEmailHtml(scope: ResetScope, fullName: string, otpCode: string): string {
  const copy = EMAIL_COPY[scope];
  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><title>${copy.title}</title></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 24px; margin: 0;">
        <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="background-color: #022c22; padding: 28px 24px; text-align: center;">
            <h1 style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 700; letter-spacing: 1px;">TRAVINCO</h1>
            <p style="color: #a7f3d0; font-size: 13px; margin: 6px 0 0; text-transform: uppercase; letter-spacing: 1.5px;">${copy.title}</p>
          </div>
          <div style="padding: 32px 28px;">
            <p style="font-size: 15px; color: #1e293b; margin: 0 0 16px; font-weight: 600;">Hello ${escapeHtml(fullName)},</p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px;">${copy.intro}</p>
            <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #065f46; display: inline-block;">${otpCode}</span>
              <p style="font-size: 12px; color: #047857; margin: 8px 0 0;">Valid for ${OTP_TTL_MINUTES} minutes</p>
            </div>
            <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0;">
              If you did not request this, please ignore this email. Your existing password will remain unchanged.
            </p>
          </div>
          <div style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 16px 24px; text-align: center;">
            <p style="font-size: 11px; color: #94a3b8; margin: 0;">&copy; ${new Date().getFullYear()} Travinco Tours. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generates a code, emails it and returns the encrypted OTP ticket.
 * Callers must have already confirmed the account exists and is allowed.
 */
export async function sendPasswordOtp(params: {
  scope: ResetScope;
  email: string;
  fullName?: string;
  data?: Record<string, string>;
}): Promise<SendResetOtpResult> {
  const email = params.email.trim().toLowerCase();
  const memoryMap = getMemoryMap();
  const key = memKey(params.scope, email);

  const existing = memoryMap.get(key);
  if (existing && Date.now() - existing.createdAt < RESEND_COOLDOWN_MS) {
    return { success: false, error: 'Please wait a moment before requesting another code.' };
  }

  const otpCode = generateOtpCode();
  const codeHash = hashToken(otpCode);
  const exp = Date.now() + OTP_TTL_MINUTES * 60 * 1000;

  memoryMap.set(key, { codeHash, expiresAt: exp, attempts: 0, createdAt: Date.now() });

  const ticket: OtpTicket = { purpose: 'otp', scope: params.scope, email, codeHash, exp, data: params.data };

  const emailResult = await sendGmail({
    to: email,
    subject: `${otpCode} ${EMAIL_COPY[params.scope].subject}`,
    html: otpEmailHtml(params.scope, params.fullName || email.split('@')[0] || 'Traveler', otpCode),
  });

  if (emailResult.error) {
    memoryMap.delete(key);
    console.error('Failed to send password OTP email:', emailResult.error);
    return { success: false, error: 'Failed to send the verification code email. Please try again.' };
  }

  return { success: true, resetTicket: encryptTicket(ticket), maskedEmail: maskEmail(email) };
}

/** Reads an OTP ticket, rejecting expired tickets and tickets from another flow. */
export async function readOtpTicket(resetTicket: string, scope: ResetScope): Promise<OtpTicket | null> {
  const payload = decryptTicket<OtpTicket>(resetTicket || '');
  if (!payload || payload.purpose !== 'otp' || payload.scope !== scope || payload.exp < Date.now()) {
    return null;
  }
  return payload;
}

/** Sends a fresh code for an active OTP ticket (same email, same carried data). */
export async function resendPasswordOtp(
  resetTicket: string,
  scope: ResetScope,
  fullName?: string
): Promise<SendResetOtpResult> {
  const payload = await readOtpTicket(resetTicket, scope);
  if (!payload) {
    return { success: false, error: 'Your verification session has expired. Please start over.' };
  }
  return sendPasswordOtp({ scope, email: payload.email, fullName, data: payload.data });
}

/**
 * Checks the entered code against the ticket. Returns the decoded ticket on success.
 * Wrong codes are counted (max 5 per code) when the memory record is available.
 */
export async function checkPasswordOtp(
  resetTicket: string,
  otpCode: string,
  scope: ResetScope
): Promise<{ error?: string; ticket?: OtpTicket }> {
  const code = (otpCode || '').trim();
  if (!/^\d{6}$/.test(code)) {
    return { error: 'Please enter all 6 digits of your verification code.' };
  }

  const payload = await readOtpTicket(resetTicket, scope);
  if (!payload) {
    return { error: 'Your verification code has expired. Please request a new code.' };
  }

  const memoryMap = getMemoryMap();
  const key = memKey(scope, payload.email);
  const memRecord = memoryMap.get(key);

  // A newer code was issued: only the latest code is valid
  if (memRecord && memRecord.codeHash !== payload.codeHash) {
    return { error: 'A newer code was sent. Please use the latest code from your email.' };
  }
  if (memRecord && memRecord.attempts >= MAX_OTP_ATTEMPTS) {
    memoryMap.delete(key);
    return { error: 'Too many incorrect attempts. Please request a new code.' };
  }

  if (hashToken(code) !== payload.codeHash) {
    if (memRecord) memRecord.attempts += 1;
    return { error: 'Invalid verification code. Please check your email and try again.' };
  }

  memoryMap.delete(key);
  return { ticket: payload };
}

/** Forgot-password step 2: code verified -> short-lived ticket allowing the new password to be set. */
export async function verifyResetOtp(
  resetTicket: string,
  otpCode: string,
  scope: 'customer' | 'staff'
): Promise<VerifyResetOtpResult> {
  const checked = await checkPasswordOtp(resetTicket, otpCode, scope);
  if (!checked.ticket) return { error: checked.error };

  const verified: VerifiedTicket = {
    purpose: 'verified',
    scope,
    email: checked.ticket.email,
    id: randomUUID(),
    exp: Date.now() + VERIFIED_TTL_MINUTES * 60 * 1000,
  };
  return { success: true, verifiedTicket: encryptTicket(verified) };
}

/** Reads a verified ticket (forgot-password step 3); single use per server instance. */
export async function readVerifiedTicket(
  verifiedTicket: string,
  scope: 'customer' | 'staff'
): Promise<VerifiedTicket | null> {
  const payload = decryptTicket<VerifiedTicket>(verifiedTicket || '');
  if (!payload || payload.purpose !== 'verified' || payload.scope !== scope || payload.exp < Date.now()) {
    return null;
  }
  if (getUsedTickets().has(payload.id)) return null;
  return payload;
}

/** Finds the auth user id for an email (customer_accounts / profiles first, then Auth). */
async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const service = createServiceClient();
  const [{ data: account }, { data: profile }] = await Promise.all([
    service.from('customer_accounts').select('id').ilike('email', escapeLike(email)).limit(1),
    service.from('profiles').select('id').ilike('email', escapeLike(email)).limit(1),
  ]);
  for (const candidate of [account?.[0]?.id, profile?.[0]?.id]) {
    if (!candidate) continue;
    const { data } = await service.auth.admin.getUserById(candidate);
    if (data?.user?.email?.toLowerCase() === email) return data.user.id;
  }

  // Page through Auth users (listUsers returns only 50 per page by default)
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

/** Sets a user's password with the service role. Optionally creates a missing customer login. */
export async function setPasswordForEmail(
  email: string,
  password: string,
  opts: { createCustomerIfMissing?: boolean; fullName?: string } = {}
): Promise<SaveResetPasswordResult> {
  const service = createServiceClient();
  const normalized = email.trim().toLowerCase();

  try {
    const userId = await findAuthUserIdByEmail(normalized);
    if (userId) {
      const { error } = await service.auth.admin.updateUserById(userId, { password });
      if (error) {
        console.error('Failed to update password:', error);
        return { error: error.message || 'Failed to update the password.' };
      }
      return { success: true };
    }

    if (!opts.createCustomerIfMissing) {
      return { error: 'Account not found. Please contact the Travinco team.' };
    }

    // Customer known only from the customers table: create their login now
    const fullName = opts.fullName || normalized.split('@')[0];
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email: normalized,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: 'customer', is_customer_signup: 'true' },
    });
    if (createError || !created?.user) {
      console.error('Failed to create customer user during reset:', createError);
      return { error: createError?.message || 'Failed to update the password.' };
    }
    await service
      .from('customer_accounts')
      .upsert({ id: created.user.id, email: normalized, full_name: fullName }, { onConflict: 'id' });
    return { success: true };
  } catch (err: any) {
    console.error('Error while saving password:', err);
    return { error: err?.message || 'Could not update the password. Please try again.' };
  }
}

/** Forgot-password step 3: with a verified ticket, validate and save the new password. */
export async function saveResetPassword(params: {
  verifiedTicket: string;
  password: string;
  confirmPassword: string;
  scope: 'customer' | 'staff';
}): Promise<SaveResetPasswordResult & { email?: string }> {
  const ticket = await readVerifiedTicket(params.verifiedTicket, params.scope);
  if (!ticket) {
    return { error: 'Your verification has expired. Please start the password reset again.' };
  }

  const parsed = resetPasswordSchema.safeParse({
    password: params.password,
    confirmPassword: params.confirmPassword,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid password format.' };
  }

  const result = await setPasswordForEmail(ticket.email, parsed.data.password, {
    createCustomerIfMissing: params.scope === 'customer',
  });
  if (!result.success) return result;

  getUsedTickets().set(ticket.id, ticket.exp);
  await clearLoginAttempts(ticket.email, params.scope === 'staff' ? 'admin' : 'customer');
  return { success: true, email: ticket.email };
}
