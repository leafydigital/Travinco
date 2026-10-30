'use server';

import { createCustomerClient, createAdminClient, CUSTOMER_AUTH_COOKIE } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireCustomer } from '@/lib/supabase/customer-auth-helpers';
import {
  checkLoginLockout,
  recordFailedLoginAttempt,
  clearLoginAttempts,
  MAX_LOGIN_ATTEMPTS,
  MAX_ADMIN_LOGIN_ATTEMPTS,
} from '@/lib/auth/login-limiter';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  getCustomerAccountStatus,
  accountStatusMessage,
} from '@/lib/auth/account-status';
import {
  initiateCustomerLoginFlow,
  resendCustomerLoginOtpFlow,
  verifyCustomerLoginOtpFlow,
  type InitiateLoginResult,
  type VerifyLoginOtpResult,
} from '@/lib/auth/login-otp';
import {
  initiateCustomerSignupFlow,
  resendCustomerSignupOtpFlow,
  verifyCustomerSignupOtpFlow,
  checkSignupAvailabilityFlow,
  type InitiateSignupResult,
  type VerifySignupResult,
  type SignupAvailability,
} from '@/lib/auth/signup-otp';
import { EMAIL_REGEX, USERNAME_MAX, USERNAME_MIN, escapeLike } from '@/lib/auth/signup-rules';
import { validateFullName } from '@/lib/validations/contact-rules';

// Any characters are allowed in usernames except whitespace
const usernameRule = z
  .string()
  .trim()
  .min(USERNAME_MIN, `Username must be at least ${USERNAME_MIN} characters.`)
  .max(USERNAME_MAX, `Username must be at most ${USERNAME_MAX} characters.`)
  .regex(/^\S+$/, 'Username cannot contain spaces.');

const emailRule = z
  .string()
  .trim()
  .regex(EMAIL_REGEX, 'Enter a valid email address (e.g. name@example.com).');

const initiateSignupSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .superRefine((v, ctx) => {
        const err = validateFullName(v);
        if (err) ctx.addIssue({ code: 'custom', message: err });
      }),
    username: usernameRule,
    email: emailRule,
    phone: z.string().trim().min(1, 'Please enter your mobile number.'),
    password: z
      .string()
      .min(7, 'Password must be at least 7 characters.')
      .regex(/[A-Z]/, 'Password must include at least one capital letter.')
      .regex(/[a-z]/, 'Password must include at least one lowercase letter.')
      .regex(/[0-9]/, 'Password must include at least one number.')
      .regex(/[^A-Za-z0-9]/, 'Password must include at least one symbol.'),
    confirm_password: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match.',
    path: ['confirm_password'],
  });

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Please enter your email or username'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Step 1 of OTP Signup: Validates name, username, email, password, confirm password,
 * checks for duplicate email and username, and sends a 6-digit OTP to the user's Gmail.
 */
export async function initiateCustomerSignup(raw: unknown): Promise<InitiateSignupResult> {
  const parsed = initiateSignupSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }
  return initiateCustomerSignupFlow({
    fullName: parsed.data.full_name,
    username: parsed.data.username,
    email: parsed.data.email,
    phone: parsed.data.phone,
    password: parsed.data.password,
    confirmPassword: parsed.data.confirm_password,
  });
}

/**
 * Live "already exists" check for the signup form (username / email / mobile), called
 * when a field loses focus so the visitor gets feedback before submitting.
 */
export async function checkSignupAvailability(input: {
  username?: string;
  email?: string;
  phone?: string;
}): Promise<SignupAvailability> {
  return checkSignupAvailabilityFlow({
    username: typeof input?.username === 'string' ? input.username.slice(0, 64) : undefined,
    email: typeof input?.email === 'string' ? input.email.slice(0, 254) : undefined,
    phone: typeof input?.phone === 'string' ? input.phone.slice(0, 20) : undefined,
  });
}

/**
 * Resends a fresh 6-digit signup OTP for an active signup ticket.
 */
export async function resendCustomerSignupOtp(signupTicket: string): Promise<{
  error?: string;
  success?: boolean;
}> {
  if (!signupTicket) return { error: 'Invalid signup session.' };
  return resendCustomerSignupOtpFlow(signupTicket);
}

/**
 * Step 2 of OTP Signup: Verifies 6-digit OTP, creates the user account in Supabase
 * without sending an email confirmation link, and dispatches the welcome email.
 */
export async function verifyCustomerSignupOtp(
  signupTicket: string,
  otp: string
): Promise<VerifySignupResult> {
  if (!signupTicket) return { error: 'Invalid signup session.' };
  return verifyCustomerSignupOtpFlow(signupTicket, otp);
}

/**
 * Customer sign-in (/account/login). Staff use their own sign-in page at /app.
 * Correct username/email + password signs the customer in directly (no email OTP);
 * failed attempts are limited per device (see login-limiter).
 */
export async function initiateCustomerLogin(raw: unknown): Promise<InitiateLoginResult> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }
  const result = await initiateCustomerLoginFlow(parsed.data.email, parsed.data.password);
  return { ...result, userType: 'customer' };
}

/**
 * Resends a fresh login verification code for an active login ticket.
 */
export async function resendCustomerLoginOtp(loginTicket: string): Promise<{
  error?: string;
  success?: boolean;
}> {
  if (!loginTicket) return { error: 'Invalid login session.' };
  return resendCustomerLoginOtpFlow(loginTicket);
}

/**
 * Step 2 of OTP Login: Verifies the entered OTP and establishes the authenticated session.
 */
export async function verifyCustomerLoginOtp(
  loginTicket: string,
  otp: string
): Promise<VerifyLoginOtpResult> {
  if (!loginTicket) return { error: 'Invalid login session.' };
  return verifyCustomerLoginOtpFlow(loginTicket, otp);
}

export async function logInCustomer(raw: unknown) {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  // 1. Check if customer account is temporarily locked out
  const lockoutStatus = await checkLoginLockout(parsed.data.email, 'customer');
  if (lockoutStatus.limitReached || lockoutStatus.isLocked) {
    const mins = lockoutStatus.minutesRemaining || 15;
    return {
      error: lockoutStatus.limitReached
        ? 'You have reached your login limit. Please reset your password.'
        : `Account is temporarily locked due to 5 consecutive failed login attempts. Please try again in ${mins} minute${mins === 1 ? '' : 's'} or use "Forgot password?".`,
      isLocked: lockoutStatus.isLocked,
      limitReached: lockoutStatus.limitReached,
      remainingAttempts: 0,
    };
  }

  const supabase = await createCustomerClient();
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !authData?.user) {
    if (error?.message.toLowerCase().includes('email not confirmed')) {
      return {
        error:
          'Please confirm your email first — check your inbox for the link we sent when you signed up.',
      };
    }

    // 2. Record failed login attempt and check 5-attempt limit
    const attemptStatus = await recordFailedLoginAttempt(parsed.data.email, 'customer');
    if (attemptStatus.isLocked) {
      return {
        error: `Too many failed login attempts (${MAX_LOGIN_ATTEMPTS}/${MAX_LOGIN_ATTEMPTS}). Your account is locked for 15 minutes. Please try again later or use "Forgot password?".`,
        isLocked: true,
        remainingAttempts: 0,
      };
    }

    const remaining = attemptStatus.remainingAttempts;
    return {
      error: `Incorrect email or password. You have ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before account lockout.`,
      remainingAttempts: remaining,
    };
  }

  // Optimize: query customers and customer_accounts in parallel
  const [custRecordRes, customerAccountRes] = await Promise.all([
    supabase
      .from('customers')
      .select('id, is_active')
      .eq('email', parsed.data.email)
      .maybeSingle(),
    supabase
      .from('customer_accounts')
      .select('id')
      .eq('id', authData.user.id)
      .maybeSingle(),
  ]);

  const custRecord = custRecordRes.data;

  // Deactivated / deleted customers cannot sign in
  const blocked = accountStatusMessage(await getCustomerAccountStatus(parsed.data.email));
  if (blocked) {
    await supabase.auth.signOut();
    return { error: blocked };
  }

  const customerAccount = customerAccountRes.data;

  // 3. Clear failed login attempts upon successful authentication
  await clearLoginAttempts(parsed.data.email, 'customer');

  // Fast-path: Verified existing customer account
  if (customerAccount) {
    return { success: true };
  }

  // Ensure this authenticated user is not staff accessing customer portal
  const isCustomerRole =
    authData.user.user_metadata?.role === 'customer' ||
    authData.user.user_metadata?.is_customer_signup === 'true';

  if (!isCustomerRole) {
    // Check if this user is a staff member
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profile?.role) {
      return { success: true, isStaff: true };
    }
  }

  // Regular customer whose customer_accounts record was not populated yet by trigger
  try {
    const fullName = (authData.user.user_metadata?.full_name as string) || authData.user.email?.split('@')[0] || 'Customer';
    await supabase.from('customer_accounts').upsert({
      id: authData.user.id,
      full_name: fullName,
      email: authData.user.email!,
    }, { onConflict: 'id' });

    // Also ensure customer appears in public.customers
    if (!custRecord) {
      await supabase.from('customers').insert({
        full_name: fullName,
        email: authData.user.email!,
        phone: '',
        source: 'website',
        is_active: true,
        is_deleted: false,
      } as any);
    }
  } catch (insertErr) {
    console.error('Failed to create customer_accounts record:', insertErr);
  }

  return { success: true };
}

export async function logOutCustomer() {
  try {
    const supabase = await createCustomerClient();
    await Promise.race([
      supabase.auth.signOut(),
      new Promise((resolve) => setTimeout(resolve, 300)),
    ]);

    const cookieStore = await cookies();
    cookieStore.delete(CUSTOMER_AUTH_COOKIE);
    for (let i = 0; i <= 4; i++) {
      cookieStore.delete(`${CUSTOMER_AUTH_COOKIE}.${i}`);
    }
  } catch (err) {
    console.warn('Customer signOut error caught:', err);
  }
  return { success: true };
}

// ─── Forgot password (/account/login) ─────────────────────────────────────────
// 1. Email / username -> account must exist and be active -> 6-digit code emailed
// 2. Code -> verified ticket
// 3. New password + confirm -> saved

export type StartResetResult = {
  success: boolean;
  error?: string;
  email?: string;
  resetTicket?: string;
  maskedEmail?: string;
};

export async function startCustomerPasswordReset(identifier: string): Promise<StartResetResult> {
  const { checkCustomerEmailExists, sendPasswordOtp } = await import('@/lib/auth/password-reset-otp');
  const check = await checkCustomerEmailExists(String(identifier ?? '').slice(0, 254));
  if (!check.success || !check.email) {
    return { success: false, error: check.error || 'No customer account found with this email address.' };
  }
  const sent = await sendPasswordOtp({ scope: 'customer', email: check.email, fullName: check.fullName });
  if (!sent.success) return { success: false, error: sent.error };
  return { success: true, email: check.email, resetTicket: sent.resetTicket, maskedEmail: sent.maskedEmail };
}

export async function resendCustomerResetOtpAction(resetTicket: string) {
  const { resendPasswordOtp } = await import('@/lib/auth/password-reset-otp');
  return resendPasswordOtp(resetTicket, 'customer');
}

export async function verifyCustomerResetOtpAction(resetTicket: string, otpCode: string) {
  const { verifyResetOtp } = await import('@/lib/auth/password-reset-otp');
  return verifyResetOtp(resetTicket, otpCode, 'customer');
}

export async function saveCustomerResetPasswordAction(data: {
  verifiedTicket: string;
  password: string;
  confirmPassword: string;
}): Promise<{ success?: boolean; error?: string }> {
  const { readVerifiedTicket, saveResetPassword } = await import('@/lib/auth/password-reset-otp');

  // Re-check status: the account may have been deactivated while the code was pending
  const ticket = await readVerifiedTicket(data?.verifiedTicket, 'customer');
  if (ticket) {
    const blocked = accountStatusMessage(await getCustomerAccountStatus(ticket.email));
    if (blocked) return { error: blocked };
  }

  const result = await saveResetPassword({
    verifiedTicket: data?.verifiedTicket,
    password: data?.password,
    confirmPassword: data?.confirmPassword,
    scope: 'customer',
  });
  return result.success ? { success: true } : { error: result.error };
}

// ─── Update password (signed in, /account/change-password) ───────────────────
// Current + new + confirm -> current password verified -> code emailed to the
// account address -> code -> new password saved.

const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Please enter your current password.'),
    newPassword: z
      .string()
      .min(7, 'Password must be at least 7 characters')
      .regex(/[A-Z]/, 'Password must include at least one capital letter')
      .regex(/[a-z]/, 'Password must include at least one lowercase letter')
      .regex(/[0-9]/, 'Password must include at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must include at least one symbol'),
    confirmPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: 'Your new password must be different from your current password.',
    path: ['newPassword'],
  });

const CURRENT_PASSWORD_MAX_FAILURES = 5;
const CURRENT_PASSWORD_LOCK_MS = 15 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var __travincoCurrentPasswordFailures: Map<string, { count: number; lockedUntil: number }> | undefined;
}

function currentPasswordFailures() {
  if (!globalThis.__travincoCurrentPasswordFailures) {
    globalThis.__travincoCurrentPasswordFailures = new Map();
  }
  return globalThis.__travincoCurrentPasswordFailures;
}

/** Checks a password without touching the browser session (no cookies are written). */
async function isCorrectPassword(email: string, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;
  const transient = createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await transient.auth.signInWithPassword({ email, password });
  return !error && Boolean(data?.user);
}

export async function startCustomerPasswordUpdate(raw: unknown): Promise<{
  success?: boolean;
  error?: string;
  field?: 'currentPassword' | 'newPassword' | 'confirmPassword';
  resetTicket?: string;
  maskedEmail?: string;
}> {
  const customer = await requireCustomer('/account/change-password');

  const parsed = updatePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      error: issue?.message ?? 'Please check the form.',
      field: issue?.path?.[0] as 'currentPassword' | 'newPassword' | 'confirmPassword' | undefined,
    };
  }

  const failures = currentPasswordFailures();
  const record = failures.get(customer.id);
  if (record && record.lockedUntil > Date.now()) {
    const mins = Math.ceil((record.lockedUntil - Date.now()) / 60000);
    return {
      error: `Too many incorrect attempts. Please try again in ${mins} minute${mins === 1 ? '' : 's'}.`,
      field: 'currentPassword',
    };
  }

  if (!(await isCorrectPassword(customer.email, parsed.data.currentPassword))) {
    // An expired lock starts a fresh count
    const count = (record && record.lockedUntil === 0 ? record.count : 0) + 1;
    const locked = count >= CURRENT_PASSWORD_MAX_FAILURES;
    failures.set(customer.id, { count: locked ? 0 : count, lockedUntil: locked ? Date.now() + CURRENT_PASSWORD_LOCK_MS : 0 });
    return {
      error: locked
        ? 'Too many incorrect attempts. Please try again in 15 minutes.'
        : 'Your current password is incorrect.',
      field: 'currentPassword',
    };
  }
  failures.delete(customer.id);

  const { sendPasswordOtp } = await import('@/lib/auth/password-reset-otp');
  const sent = await sendPasswordOtp({
    scope: 'change',
    email: customer.email,
    fullName: customer.full_name || undefined,
    data: { userId: customer.id, password: parsed.data.newPassword },
  });
  if (!sent.success) return { error: sent.error };
  return { success: true, resetTicket: sent.resetTicket, maskedEmail: sent.maskedEmail };
}

export async function resendCustomerPasswordUpdateOtp(resetTicket: string) {
  const customer = await requireCustomer('/account/change-password');
  const { readOtpTicket, resendPasswordOtp } = await import('@/lib/auth/password-reset-otp');
  const ticket = await readOtpTicket(resetTicket, 'change');
  if (!ticket || ticket.data?.userId !== customer.id) {
    return { success: false, error: 'Your verification session has expired. Please start over.' };
  }
  return resendPasswordOtp(resetTicket, 'change', customer.full_name || undefined);
}

export async function confirmCustomerPasswordUpdate(
  resetTicket: string,
  otpCode: string
): Promise<{ success?: boolean; error?: string }> {
  const customer = await requireCustomer('/account/change-password');
  const { readOtpTicket, checkPasswordOtp } = await import('@/lib/auth/password-reset-otp');

  // The ticket must belong to the signed-in customer before the code is even checked
  const pending = await readOtpTicket(resetTicket, 'change');
  if (!pending || pending.data?.userId !== customer.id || !pending.data?.password) {
    return { error: 'Your verification session has expired. Please start over.' };
  }

  const checked = await checkPasswordOtp(resetTicket, otpCode, 'change');
  if (!checked.ticket) return { error: checked.error };

  const service = createServiceClient();
  const { error } = await service.auth.admin.updateUserById(customer.id, {
    password: checked.ticket.data!.password,
  });
  if (error) {
    console.error('Password update failed:', error.message);
    return { error: 'Could not update your password. Please try again.' };
  }

  await clearLoginAttempts(customer.email, 'customer');
  return { success: true };
}

// ─── Profile (/account/profile) ───────────────────────────────────────────────

export type CustomerProfile = {
  full_name: string;
  email: string;
  phone: string;
  address: string;
  /** When the customer account was created (ISO string). */
  member_since: string | null;
};

/** Latest non-deleted customers row for an email (enquiries can create duplicates). */
async function findCustomerRow(service: ReturnType<typeof createServiceClient>, email: string) {
  const { data } = await service
    .from('customers')
    .select('id, full_name, phone, address, is_deleted, created_at')
    .ilike('email', escapeLike(email))
    .order('created_at', { ascending: true })
    .limit(20);
  return (data ?? []).find((r: any) => r.is_deleted !== true) ?? null;
}

export async function getCustomerProfile(): Promise<CustomerProfile> {
  const customer = await requireCustomer('/account/profile');
  const service = createServiceClient();

  // phone / address columns on customer_accounts come from the profile migration;
  // until it is run, fall back to the customers row (which already has both).
  const [{ data: account, error: accountError }, custRow] = await Promise.all([
    service.from('customer_accounts').select('full_name, phone, address').eq('id', customer.id).maybeSingle(),
    findCustomerRow(service, customer.email),
  ]);
  const acc = accountError ? null : (account as { full_name?: string; phone?: string; address?: string } | null);

  return {
    full_name: acc?.full_name || customer.full_name || custRow?.full_name || '',
    email: customer.email,
    phone: acc?.phone || custRow?.phone || '',
    address: acc?.address || custRow?.address || '',
    member_since: customer.created_at ?? null,
  };
}

const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'Please enter your full name.').max(120, 'Name is too long.'),
  phone: z.string().trim().min(1, 'Please enter your mobile number.'),
  address: z.string().trim().max(500, 'Address is too long (max 500 characters).').optional().default(''),
});

export async function updateCustomerProfile(raw: unknown): Promise<{
  success?: boolean;
  error?: string;
  field?: 'full_name' | 'phone' | 'address';
  profile?: CustomerProfile;
}> {
  const customer = await requireCustomer('/account/profile');

  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? 'Please check the form.', field: issue?.path?.[0] as any };
  }

  const { parsePhoneNumberFromString, isValidPhoneNumber } = await import('libphonenumber-js/mobile');
  const phoneParsed = parsePhoneNumberFromString(parsed.data.phone);
  const phone = phoneParsed?.number ?? '';
  if (!phone || !isValidPhoneNumber(phone)) {
    return { error: 'Enter a valid mobile number.', field: 'phone' };
  }

  const service = createServiceClient();
  const fullName = parsed.data.full_name;
  const address = parsed.data.address || '';

  // customer_accounts: try with the new columns, fall back if the migration hasn't run
  let { error: accErr } = await service
    .from('customer_accounts')
    .update({ full_name: fullName, phone, address } as any)
    .eq('id', customer.id);
  if (accErr && /phone|address/.test(accErr.message || '')) {
    ({ error: accErr } = await service
      .from('customer_accounts')
      .update({ full_name: fullName })
      .eq('id', customer.id));
  }
  if (accErr) {
    console.error('updateCustomerProfile customer_accounts:', accErr.message);
    return { error: 'Could not save your profile. Please try again.' };
  }

  // Keep the customers row (what the Travinco team sees) in sync
  const custRow = await findCustomerRow(service, customer.email);
  if (custRow) {
    const { error } = await service
      .from('customers')
      .update({ full_name: fullName, phone, address: address || null } as any)
      .eq('id', custRow.id);
    if (error) console.warn('updateCustomerProfile customers sync:', error.message);
  } else {
    const { error } = await service.from('customers').insert({
      full_name: fullName,
      email: customer.email,
      phone,
      address: address || null,
      source: 'website',
      is_active: true,
      is_deleted: false,
    } as any);
    if (error) console.warn('updateCustomerProfile customers insert:', error.message);
  }

  // Name shown in the header comes from Auth metadata as a fallback
  try {
    await service.auth.admin.updateUserById(customer.id, {
      user_metadata: { full_name: fullName },
    });
  } catch {}

  revalidatePath('/account', 'layout');
  return { success: true, profile: {
      full_name: fullName,
      email: customer.email,
      phone,
      address,
      member_since: customer.created_at ?? null,
    },
  };
}
