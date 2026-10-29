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
import { z } from 'zod';

const RESET_OTP_TTL_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

type ResetOtpMemoryRecord = {
  codeHash: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
  userId?: string;
};

// Global memory cache across requests (survives HMR in local dev)
declare global {
  // eslint-disable-next-line no-var
  var __travincoResetOtpMemoryMap: Map<string, ResetOtpMemoryRecord> | undefined;
}

function getMemoryMap(): Map<string, ResetOtpMemoryRecord> {
  if (!globalThis.__travincoResetOtpMemoryMap) {
    globalThis.__travincoResetOtpMemoryMap = new Map();
  }
  return globalThis.__travincoResetOtpMemoryMap;
}

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
        const { data: usersData } = await serviceSupabase.auth.admin.listUsers();
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
        if (customerRow.is_deleted) {
          return { success: false, error: 'This customer account has been deleted.' };
        }
        if (customerRow.is_active === false) {
          return {
            success: false,
            error: 'This account has been deactivated. Please contact support.',
          };
        }
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
      const { data: usersData, error: listError } = await serviceSupabase.auth.admin.listUsers();
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

  return {
    success: true,
    email: targetEmail,
    fullName: foundUser.fullName,
  };
}

/**
 * Step 2: User has entered and confirmed their new password.
 * Validates password rules, generates 6-digit OTP, encrypts the pending reset payload,
 * and sends the 6-digit OTP code to the customer's email.
 */
export async function sendResetPasswordOtpWithNewPassword(params: {
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<SendResetOtpResult> {
  const trimmedEmail = params.email.trim().toLowerCase();

  // 1. Validate password schema
  const parsed = resetPasswordSchema.safeParse({
    password: params.password,
    confirmPassword: params.confirmPassword,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid password format.',
    };
  }

  // 2. Ensure customer exists
  const check = await checkCustomerEmailExists(trimmedEmail);
  if (!check.success) {
    return { success: false, error: check.error };
  }

  // 3. Generate OTP and expiration
  const otpCode = generateOtpCode();
  const expiresAtMs = Date.now() + RESET_OTP_TTL_MINUTES * 60 * 1000;
  const hashedCode = hashToken(otpCode);

  const memoryMap = getMemoryMap();
  memoryMap.set(trimmedEmail, {
    codeHash: hashedCode,
    expiresAt: expiresAtMs,
    attempts: 0,
    createdAt: Date.now(),
  });

  // Securely encrypt the pending password reset payload
  const resetTicket = encryptTicket({
    email: trimmedEmail,
    password: parsed.data.password,
    codeHash: hashedCode,
    exp: expiresAtMs,
  });

  // 4. Send rich email via Gmail
  const fullName = check.fullName || 'Traveler';
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Reset Your Travinco Password</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 24px; margin: 0;">
        <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="background-color: #022c22; padding: 28px 24px; text-align: center;">
            <h1 style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 700; letter-spacing: 1px;">TRAVINCO</h1>
            <p style="color: #a7f3d0; font-size: 13px; margin: 6px 0 0; text-transform: uppercase; letter-spacing: 1.5px;">Password Reset Verification</p>
          </div>
          <div style="padding: 32px 28px;">
            <p style="font-size: 15px; color: #1e293b; margin: 0 0 16px; font-weight: 600;">Hello ${fullName},</p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px;">
              You have requested to reset your password for your Travinco account. Please enter the 6-digit verification code below to confirm and save your new password:
            </p>
            <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #065f46; display: inline-block;">
                ${otpCode}
              </span>
              <p style="font-size: 12px; color: #047857; margin: 8px 0 0;">Valid for ${RESET_OTP_TTL_MINUTES} minutes</p>
            </div>
            <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0 0 8px;">
              If you did not request this password reset, please ignore this email. Your existing password will remain safe and unchanged.
            </p>
          </div>
          <div style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 16px 24px; text-align: center;">
            <p style="font-size: 11px; color: #94a3b8; margin: 0;">&copy; ${new Date().getFullYear()} Travinco Tours. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const emailResult = await sendGmail({
    to: trimmedEmail,
    subject: `${otpCode} is your Travinco password reset verification code`,
    html,
  });

  if (emailResult.error) {
    console.error('Failed to send reset verification email:', emailResult.error);
    return {
      success: false,
      error: 'Failed to send verification code email. Please try again.',
    };
  }

  return {
    success: true,
    resetTicket,
    maskedEmail: maskEmail(trimmedEmail),
  };
}

/**
 * Resends a fresh password reset OTP for an active reset ticket.
 */
export async function resendCustomerResetPasswordOtpFlow(
  resetTicket: string
): Promise<{
  error?: string;
  success?: boolean;
  resetTicket?: string;
}> {
  const payload = decryptTicket<{
    email: string;
    password: string;
    codeHash: string;
    exp: number;
  }>(resetTicket);

  if (!payload || payload.exp < Date.now()) {
    return { error: 'Your reset session has expired. Please start over.' };
  }

  const trimmedEmail = payload.email.trim().toLowerCase();
  const memoryMap = getMemoryMap();
  const existingMem = memoryMap.get(trimmedEmail);

  if (existingMem && Date.now() - existingMem.createdAt < 45 * 1000) {
    return { error: 'Please wait a moment before requesting another code.' };
  }

  const otpCode = generateOtpCode();
  const expiresAtMs = Date.now() + RESET_OTP_TTL_MINUTES * 60 * 1000;
  const hashedCode = hashToken(otpCode);

  memoryMap.set(trimmedEmail, {
    codeHash: hashedCode,
    expiresAt: expiresAtMs,
    attempts: 0,
    createdAt: Date.now(),
  });

  const newTicket = encryptTicket({
    email: trimmedEmail,
    password: payload.password,
    codeHash: hashedCode,
    exp: expiresAtMs,
  });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Your New Travinco Password Reset Code</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 24px; margin: 0;">
        <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="background-color: #022c22; padding: 28px 24px; text-align: center;">
            <h1 style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 700; letter-spacing: 1px;">TRAVINCO</h1>
            <p style="color: #a7f3d0; font-size: 13px; margin: 6px 0 0; text-transform: uppercase; letter-spacing: 1.5px;">Password Reset Verification</p>
          </div>
          <div style="padding: 32px 28px;">
            <p style="font-size: 15px; color: #1e293b; margin: 0 0 16px; font-weight: 600;">Hello,</p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px;">
              Here is your new 6-digit password reset verification code:
            </p>
            <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #065f46; display: inline-block;">
                ${otpCode}
              </span>
              <p style="font-size: 12px; color: #047857; margin: 8px 0 0;">Valid for ${RESET_OTP_TTL_MINUTES} minutes</p>
            </div>
            <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0 0 8px;">
              If you did not request this password reset, please ignore this email.
            </p>
          </div>
          <div style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 16px 24px; text-align: center;">
            <p style="font-size: 11px; color: #94a3b8; margin: 0;">&copy; ${new Date().getFullYear()} Travinco Tours. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const emailResult = await sendGmail({
    to: trimmedEmail,
    subject: `${otpCode} is your new Travinco password reset code`,
    html,
  });

  if (emailResult.error) {
    return { error: 'Failed to resend verification code. Please try again.' };
  }

  return { success: true, resetTicket: newTicket };
}

/**
 * Step 3: Verifies OTP code and saves the new password directly in the database.
 */
export async function verifyOtpAndSavePasswordFlow(params: {
  resetTicket: string;
  otpCode: string;
}): Promise<VerifyResetOtpResult> {
  const code = params.otpCode.trim();

  if (code.length !== 6) {
    return { error: 'Please enter all 6 digits of your verification code.' };
  }

  // 1. Decrypt reset ticket
  const payload = decryptTicket<{
    email: string;
    password: string;
    codeHash: string;
    exp: number;
  }>(params.resetTicket);

  if (!payload || payload.exp < Date.now()) {
    return { error: 'Your reset session has expired. Please start over.' };
  }

  const normalizedEmail = payload.email.trim().toLowerCase();

  // 2. Verify OTP code
  const memoryMap = getMemoryMap();
  const memRecord = memoryMap.get(normalizedEmail);

  if (memRecord) {
    if (memRecord.expiresAt < Date.now()) {
      memoryMap.delete(normalizedEmail);
      return { error: 'Verification code has expired. Please request a new code.' };
    }
    if (memRecord.attempts >= MAX_OTP_ATTEMPTS) {
      memoryMap.delete(normalizedEmail);
      return { error: 'Too many incorrect attempts. Please request a new code.' };
    }
  }

  const enteredHash = hashToken(code);
  const expectedHash = memRecord?.codeHash || payload.codeHash;

  if (enteredHash !== expectedHash) {
    if (memRecord) memRecord.attempts += 1;
    return { error: 'Invalid verification code. Please check your email and try again.' };
  }

  // 3. OTP verified -> Update password in Supabase DB
  const serviceSupabase = createServiceClient();

  try {
    const { data: usersData } = await serviceSupabase.auth.admin.listUsers();
    const targetUser = usersData?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );

    if (targetUser) {
      const { error: adminError } = await serviceSupabase.auth.admin.updateUserById(
        targetUser.id,
        { password: payload.password }
      );
      if (adminError) {
        console.error('Failed to update customer password in auth.users:', adminError);
        return { error: adminError.message || 'Failed to update password in database.' };
      }
    } else {
      // Create auth user if they existed in customers table only
      const { error: createError } = await serviceSupabase.auth.admin.createUser({
        email: normalizedEmail,
        password: payload.password,
        email_confirm: true,
      });
      if (createError) {
        console.error('Failed to create customer user during reset:', createError);
        return { error: createError.message || 'Failed to update password in database.' };
      }
    }

    // 4. Clean up memory store and clear any login lockouts
    memoryMap.delete(normalizedEmail);
    await clearLoginAttempts(normalizedEmail, 'customer');

    return { success: true };
  } catch (err: any) {
    console.error('Error during password reset execution:', err);
    return { error: err?.message || 'Could not update password. Please try again.' };
  }
}
