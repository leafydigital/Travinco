'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  checkLoginLockout,
  recordFailedLoginAttempt,
  clearLoginAttempts,
} from '@/lib/auth/login-limiter';
import { z } from 'zod';
import { getStaffAccountStatus, accountStatusMessage } from '@/lib/auth/account-status';
import { escapeLike } from '@/lib/auth/signup-rules';

const STAFF_ROLES = ['super_admin', 'admin', 'sales_staff', 'accounts_staff'];

const staffLoginSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(1, 'Enter your username or email'),
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

/** Resolves a username to the account's email; anything containing "@" is treated as the email itself. */
async function resolveStaffEmail(identifier: string): Promise<string | null> {
  if (identifier.includes('@')) return identifier;
  const { data } = await createServiceClient()
    .from('profiles')
    .select('email')
    .ilike('username', escapeLike(identifier))
    .limit(1);
  return data?.[0]?.email?.toLowerCase() ?? null;
}

/**
 * Staff / admin sign-in for the internal team (/app), by username or email.
 * Customers sign in separately at /account/login.
 * Failed attempts are limited per device (5 attempts, then this device waits 15 minutes).
 */
export async function staffLogin(raw: unknown): Promise<StaffLoginResult> {
  const parsed = staffLoginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }
  const { identifier, password, redirectTo } = parsed.data;
  // Unknown usernames still go through sign-in (and fail) so attempts are counted the same way
  const email = (await resolveStaffEmail(identifier)) ?? identifier;

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
      error: `Incorrect username/email or password. ${remaining} attempt${remaining === 1 ? '' : 's'} left on this device.`,
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
