'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  checkLoginLockout,
  recordFailedLoginAttempt,
  clearLoginAttempts,
} from '@/lib/auth/login-limiter';
import { z } from 'zod';
import {
  sendResetPasswordOtpWithNewPassword,
  verifyOtpAndSavePasswordFlow,
} from '@/lib/auth/password-reset-otp';
import { escapeLike } from '@/lib/auth/signup-rules';

const STAFF_ROLES = ['super_admin', 'admin', 'sales_staff', 'accounts_staff'];

const staffLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  redirectTo: z.string().optional(),
});

export type StaffLoginResult = {
  error?: string;
  isLocked?: boolean;
  remainingAttempts?: number;
  success?: boolean;
  redirectUrl?: string;
};

function safeDashboardPath(raw: string | undefined): string {
  if (
    !raw ||
    !raw.startsWith('/travinco_dashboard') ||
    raw.startsWith('//') ||
    raw.includes('\\')
  ) {
    return '/travinco_dashboard';
  }
  return raw;
}

/**
 * Staff / admin sign-in for the internal team (/app).
 * Customers sign in separately at /account/login.
 * Failed attempts are limited per device (5 attempts, then this device waits 15 minutes).
 */
export async function staffLogin(raw: unknown): Promise<StaffLoginResult> {
  const parsed = staffLoginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }
  const { email, password, redirectTo } = parsed.data;

  const lockout = await checkLoginLockout(email, 'admin');
  if (lockout.isLocked) {
    const mins = lockout.minutesRemaining || 15;
    return {
      error: `Too many failed attempts from this device. Please try again in ${mins} minute${mins === 1 ? '' : 's'}.`,
      isLocked: true,
      remainingAttempts: 0,
    };
  }

  const supabase = await createAdminClient();
  let { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });

  // Staff created from the dashboard may not have a confirmed email yet
  if (error && error.message?.toLowerCase().includes('email not confirmed')) {
    try {
      const { data: confirmed } = await supabase.rpc('confirm_staff_email', { p_email: email });
      if (confirmed) {
        const retry = await supabase.auth.signInWithPassword({ email, password });
        if (!retry.error && retry.data.user) {
          authData = retry.data;
          error = null;
        }
      }
    } catch (rpcErr) {
      console.error('Error auto-confirming staff user:', rpcErr);
    }
  }

  if (error || !authData?.user) {
    const attempt = await recordFailedLoginAttempt(email, 'admin');
    if (attempt.isLocked) {
      const mins = attempt.minutesRemaining || 15;
      return {
        error: `Too many failed attempts from this device. Please try again in ${mins} minute${mins === 1 ? '' : 's'}.`,
        isLocked: true,
        remainingAttempts: 0,
      };
    }
    const remaining = attempt.remainingAttempts;
    return {
      error: `Incorrect email or password. ${remaining} attempt${remaining === 1 ? '' : 's'} left on this device.`,
      remainingAttempts: remaining,
    };
  }

  // Must be an active staff profile and not a customer account
  const service = createServiceClient();
  const [{ data: profile }, { data: customerAccount }] = await Promise.all([
    service.from('profiles').select('id, role, is_active').eq('id', authData.user.id).maybeSingle(),
    service.from('customer_accounts').select('id').eq('id', authData.user.id).maybeSingle(),
  ]);

  if (!profile || !STAFF_ROLES.includes(profile.role) || customerAccount) {
    await supabase.auth.signOut();
    return { error: 'This is not a staff account. Customers can sign in at /account/login.' };
  }
  if (profile.is_active === false) {
    await supabase.auth.signOut();
    return { error: 'This staff account has been deactivated. Contact your administrator.' };
  }

  await clearLoginAttempts(email, 'admin');

  // Staff without dashboard access are forwarded to their first allowed page by /travinco_dashboard
  return { success: true, redirectUrl: safeDashboardPath(redirectTo) };
}

// ─── Staff "Forgot password" (stays on /app) ──────────────────────────────────
// 1. Email -> confirm it belongs to an active staff account
// 2. New password + confirm -> a 6-digit code is emailed to that address
// 3. Code -> password saved. The emailed code proves the person owns the mailbox,
//    so knowing a staff email alone is never enough to change the password.

async function findActiveStaff(email: string) {
  const service = createServiceClient();
  const { data } = await service
    .from('profiles')
    .select('id, full_name, email, role, is_active')
    .ilike('email', escapeLike(email))
    .limit(1);
  const profile = data?.[0];
  if (!profile || !STAFF_ROLES.includes(profile.role)) return { error: 'No staff account found with this email address.' };
  if (profile.is_active === false) {
    return { error: 'This staff account has been deactivated. Please contact your administrator.' };
  }
  return { profile };
}

export async function checkStaffResetEmail(
  rawEmail: string
): Promise<{ success: boolean; fullName?: string; error?: string }> {
  const email = (rawEmail || '').trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) {
    return { success: false, error: 'Enter a valid email address.' };
  }
  const found = await findActiveStaff(email);
  if (found.error) return { success: false, error: found.error };
  return { success: true, fullName: found.profile!.full_name || undefined };
}

export async function sendStaffResetCode(input: {
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<{ success: boolean; resetTicket?: string; maskedEmail?: string; error?: string }> {
  const email = (input.email || '').trim().toLowerCase();
  const found = await findActiveStaff(email);
  if (found.error) return { success: false, error: found.error };
  return sendResetPasswordOtpWithNewPassword({
    email,
    password: input.password,
    confirmPassword: input.confirmPassword,
  });
}

export async function verifyStaffResetCode(input: {
  email: string;
  resetTicket: string;
  code: string;
}): Promise<{ success?: boolean; error?: string }> {
  const result = await verifyOtpAndSavePasswordFlow({
    resetTicket: input.resetTicket,
    otpCode: input.code,
  });
  if (result.success && input.email) {
    await clearLoginAttempts(input.email.trim().toLowerCase(), 'admin');
  }
  return result;
}
