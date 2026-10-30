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
  sendPasswordOtp,
  resendPasswordOtp,
  verifyResetOtp,
  readVerifiedTicket,
  saveResetPassword,
} from '@/lib/auth/password-reset-otp';
import { getStaffAccountStatus, accountStatusMessage } from '@/lib/auth/account-status';
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
    service.from('profiles').select('*').eq('id', authData.user.id).maybeSingle(),
    service.from('customer_accounts').select('id').eq('id', authData.user.id).maybeSingle(),
  ]);

  // Deleted or deactivated by an administrator: no sign-in (checked before the role,
  // since a deleted profile may no longer look like a staff account)
  if (profile) {
    const blocked = accountStatusMessage(await getStaffAccountStatus(profile));
    if (blocked) {
      await supabase.auth.signOut();
      return { error: blocked };
    }
  }

  if (!profile || !STAFF_ROLES.includes(profile.role) || customerAccount) {
    await supabase.auth.signOut();
    return { error: 'This is not a staff account. Customers can sign in at /account/login.' };
  }

  await clearLoginAttempts(email, 'admin');

  // Staff without dashboard access are forwarded to their first allowed page by /travinco_dashboard
  return { success: true, redirectUrl: safeDashboardPath(redirectTo) };
}

// ─── Staff "Forgot password" (stays on /app) ──────────────────────────────────
// 1. Email -> must be an active staff account -> 6-digit code emailed
// 2. Code -> verified
// 3. New password + confirm -> saved. The emailed code proves the person owns the
//    mailbox, so knowing a staff email alone is never enough to change the password.

async function findActiveStaff(email: string) {
  const service = createServiceClient();
  const { data } = await service
    .from('profiles')
    .select('*')
    .ilike('email', escapeLike(email))
    .limit(1);
  const profile = data?.[0];
  if (!profile) return { error: 'No team account found with this email address.' };

  const blocked = accountStatusMessage(await getStaffAccountStatus(profile));
  if (blocked) return { error: blocked };

  if (!STAFF_ROLES.includes(profile.role)) return { error: 'No team account found with this email address.' };
  return { profile };
}

export async function startStaffPasswordReset(
  rawEmail: string
): Promise<{ success: boolean; resetTicket?: string; maskedEmail?: string; error?: string }> {
  const email = (rawEmail || '').trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) {
    return { success: false, error: 'Enter a valid email address.' };
  }
  const found = await findActiveStaff(email);
  if (found.error) return { success: false, error: found.error };
  return sendPasswordOtp({ scope: 'staff', email, fullName: found.profile!.full_name || undefined });
}

export async function resendStaffResetCode(
  resetTicket: string
): Promise<{ success: boolean; resetTicket?: string; error?: string }> {
  return resendPasswordOtp(resetTicket, 'staff');
}

export async function verifyStaffResetCode(input: {
  resetTicket: string;
  code: string;
}): Promise<{ success?: boolean; verifiedTicket?: string; error?: string }> {
  return verifyResetOtp(input.resetTicket, input.code, 'staff');
}

export async function saveStaffNewPassword(input: {
  verifiedTicket: string;
  password: string;
  confirmPassword: string;
}): Promise<{ success?: boolean; error?: string }> {
  // Re-check: the account may have been deactivated / deleted while the code was pending
  const ticket = await readVerifiedTicket(input?.verifiedTicket, 'staff');
  if (ticket) {
    const found = await findActiveStaff(ticket.email);
    if (found.error) return { error: found.error };
  }

  const result = await saveResetPassword({
    verifiedTicket: input?.verifiedTicket,
    password: input?.password,
    confirmPassword: input?.confirmPassword,
    scope: 'staff',
  });
  return result.success ? { success: true } : { error: result.error };
}
