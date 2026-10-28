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
import { z } from 'zod';
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
  type InitiateSignupResult,
  type VerifySignupResult,
} from '@/lib/auth/signup-otp';

const usernameRule = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters.')
  .max(30, 'Username must be at most 30 characters.')
  .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, dots, and underscores.');

const signupSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  username: usernameRule,
  email: z
    .string()
    .email('Enter a valid email')
    .refine((email) => {
      const e = email.toLowerCase().trim();
      return e.endsWith('@gmail.com') || e.endsWith('.in');
    }, {
      message: 'Only @gmail.com and .in email addresses are accepted.',
    }),
  password: z
    .string()
    .min(7, 'Password must be at least 7 characters')
    .regex(/[A-Z]/, 'Password must include at least one capital letter')
    .regex(/[a-z]/, 'Password must include at least one lowercase letter')
    .regex(/[0-9]/, 'Password must include at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must include at least one symbol'),
});

const initiateSignupSchema = z
  .object({
    full_name: z.string().min(1, 'Please enter your full name.'),
    username: usernameRule,
    email: z
      .string()
      .email('Please enter a valid email address.')
      .refine((email) => {
        const e = email.toLowerCase().trim();
        return e.endsWith('@gmail.com') || e.endsWith('.in');
      }, {
        message: 'Only @gmail.com and .in email addresses are accepted.',
      }),
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
    password: parsed.data.password,
    confirmPassword: parsed.data.confirm_password,
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

export async function signUpCustomer(raw: unknown) {
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  const supabase = await createCustomerClient();
  const { data: authData, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.full_name,
        username: parsed.data.username,
        is_customer_signup: 'true',
        role: 'customer',
      },
    },
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('already registered') ||
      message.includes('already exists') ||
      message.includes('user already')
    ) {
      return { error: 'Email is already taken' };
    }
    console.error('signUpCustomer failed:', error.message);
    return { error: 'Could not create your account. Please try again.' };
  }

  if (authData?.user) {
    try {
      await supabase.from('customer_accounts').upsert({
        id: authData.user.id,
        full_name: parsed.data.full_name,
        username: parsed.data.username,
        email: parsed.data.email,
      }, { onConflict: 'id' });

      // Ensure user also exists in customers table so admin/team can see them
      const { data: existingCust } = await supabase
        .from('customers')
        .select('id')
        .eq('email', parsed.data.email)
        .maybeSingle();

      if (!existingCust) {
        await supabase.from('customers').insert({
          full_name: parsed.data.full_name,
          email: parsed.data.email,
          phone: '',
          source: 'website',
          is_active: true,
          is_deleted: false,
        } as any);
      }
    } catch (upsertErr) {
      console.warn('customer_accounts/customers upsert on signup:', upsertErr);
    }
  }

  return { hasSession: Boolean(authData?.session) };
}

/**
 * Unified Login Step 1: Checks both profiles (Staff) and customer_accounts (Customer).
 * - If Staff: authenticates directly via createAdminClient(), sets admin auth cookie, and returns { userType: 'staff', redirectUrl }.
 * - If Customer: initiates customer OTP flow, sends 6-digit OTP, and returns { userType: 'customer', step: 'otp_required', loginTicket, maskedEmail }.
 */
export async function initiateCustomerLogin(raw: unknown): Promise<InitiateLoginResult> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  const trimmedInput = (parsed.data.email || '').trim();
  const password = (parsed.data.password || '').trim();

  const serviceSupabase = createServiceClient();
  let resolvedEmail: string | null = null;
  let userFullName: string | undefined;

  // 1. Resolve identifier: Is it an email or a username?
  if (trimmedInput.includes('@')) {
    resolvedEmail = trimmedInput.toLowerCase();
  } else {
    // Check customer_accounts by username
    try {
      const { data: accountRow } = await serviceSupabase
        .from('customer_accounts')
        .select('email, full_name, username')
        .ilike('username', trimmedInput)
        .maybeSingle();

      if (accountRow?.email) {
        resolvedEmail = accountRow.email.toLowerCase();
        userFullName = accountRow.full_name || undefined;
      }
    } catch (lookupErr) {
      console.warn('customer_accounts username lookup notice:', lookupErr);
    }

    // Check auth.users metadata for username
    if (!resolvedEmail) {
      try {
        const { data: usersData } = await serviceSupabase.auth.admin.listUsers();
        const match = usersData?.users?.find(
          (u) =>
            (u.user_metadata?.username as string)?.toLowerCase() === trimmedInput.toLowerCase()
        );
        if (match?.email) {
          resolvedEmail = match.email.toLowerCase();
          userFullName = (match.user_metadata?.full_name as string) || undefined;
        }
      } catch (authListErr) {
        console.warn('Fallback username lookup notice:', authListErr);
      }
    }

    if (!resolvedEmail) {
      return {
        error: 'The email/username or password you entered is incorrect.',
      };
    }
  }

  // 2. Query both tables: public.profiles (Staff) and public.customer_accounts (Customer)
  const [profileRes, customerRes] = await Promise.all([
    serviceSupabase
      .from('profiles')
      .select('id, email, full_name, role, is_active')
      .ilike('email', resolvedEmail)
      .maybeSingle(),
    serviceSupabase
      .from('customer_accounts')
      .select('id, email, full_name, username')
      .ilike('email', resolvedEmail)
      .maybeSingle(),
  ]);

  const profile = profileRes.data;
  const isStaffRole =
    profile &&
    profile.role &&
    ['super_admin', 'admin', 'sales_staff', 'accounts_staff'].includes(profile.role);

  // ── BRANCH A: STAFF / ADMIN AUTHENTICATION (DIRECT SIGN IN - OPTION A) ─────
  if (isStaffRole) {
    if (profile.is_active === false) {
      return { error: 'This staff account has been deactivated. Contact your administrator.' };
    }

    // Check staff lockout (5 attempts, 15-minute timer)
    const lockoutStatus = await checkLoginLockout(resolvedEmail, 'admin');
    if (lockoutStatus.isLocked) {
      const mins = lockoutStatus.minutesRemaining || 15;
      return {
        error: `Account is temporarily locked due to 5 consecutive failed login attempts. Please try again in ${mins} minute${mins === 1 ? '' : 's'}.`,
        isLocked: true,
        remainingAttempts: 0,
      };
    }

    const adminClient = await createAdminClient();
    let { data: authData, error: authError } = await adminClient.auth.signInWithPassword({
      email: resolvedEmail,
      password,
    });

    if (authError && authError.message?.toLowerCase().includes('email not confirmed')) {
      try {
        const { data: confirmed } = await serviceSupabase.rpc('confirm_staff_email', {
          p_email: resolvedEmail,
        });
        if (confirmed) {
          const retry = await adminClient.auth.signInWithPassword({
            email: resolvedEmail,
            password,
          });
          if (!retry.error && retry.data.user) {
            authData = retry.data;
            authError = null;
          }
        }
      } catch (rpcErr) {
        console.error('Error auto-confirming staff user:', rpcErr);
      }
    }

    if (authError || !authData?.user) {
      const attemptStatus = await recordFailedLoginAttempt(resolvedEmail, 'admin');
      if (attemptStatus.isLocked) {
        return {
          error: `Too many failed login attempts (${MAX_ADMIN_LOGIN_ATTEMPTS}/${MAX_ADMIN_LOGIN_ATTEMPTS}). Your account is locked for 15 minutes.`,
          isLocked: true,
          remainingAttempts: 0,
        };
      }
      const remaining = attemptStatus.remainingAttempts;
      return {
        error: `The email or password you entered is incorrect. You have ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before account lockout.`,
        remainingAttempts: remaining,
      };
    }

    // Successful staff login: clear attempts
    await clearLoginAttempts(resolvedEmail, 'admin');

    // Always land on /travinco_dashboard: its page already forwards staff without
    // dashboard access to their first allowed section, so resolving it here only
    // added extra round trips before the redirect.
    return {
      userType: 'staff',
      redirectUrl: '/travinco_dashboard',
    };
  }

  // ── BRANCH B: CUSTOMER AUTHENTICATION (WITH 2FA OTP) ──────────────────────
  const result = await initiateCustomerLoginFlow(resolvedEmail, password);
  return {
    ...result,
    userType: 'customer',
  };
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

  // Check if customer account is deactivated
  if (custRecord?.is_active === false) {
    await supabase.auth.signOut();
    return { error: 'Your account has been deactivated. Please contact support.' };
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

/**
 * Step 1: Confirms that the entered email matches the logged-in customer's active account.
 */
export async function verifyCustomerEmailAction(rawEmail: string) {
  const customer = await requireCustomer();

  const email = (rawEmail || '').trim().toLowerCase();
  if (!email) {
    return { error: 'Please enter your email address.' };
  }

  if (email !== customer.email.toLowerCase()) {
    return { error: 'This email does not match your active customer account.' };
  }

  return {
    success: true,
    email: customer.email,
    fullName: customer.full_name || 'Customer',
  };
}

const changePasswordSchema = z
  .object({
    email: z.string().email('Enter a valid email').optional(),
    password: z
      .string()
      .min(7, 'Password must be at least 7 characters')
      .regex(/[A-Z]/, 'Password must include at least one capital letter')
      .regex(/[a-z]/, 'Password must include at least one lowercase letter')
      .regex(/[0-9]/, 'Password must include at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must include at least one symbol'),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) => !data.confirmPassword || data.password === data.confirmPassword,
    {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }
  );

export async function changeCustomerPassword(raw: unknown) {
  // Enforces that the session is a verified customer account
  const customer = await requireCustomer();

  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  if (
    parsed.data.email &&
    parsed.data.email.trim().toLowerCase() !== customer.email.toLowerCase()
  ) {
    return { error: 'Email does not match your active customer account.' };
  }

  const supabase = await createCustomerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message || 'Could not update your password. Please try again.' };

  await clearLoginAttempts(customer.email, 'customer');

  return { success: true };
}

/**
 * Step 1: Checks if customer email exists in the database.
 */
export async function checkCustomerEmailExistsAction(email: string) {
  const { checkCustomerEmailExists } = await import('@/lib/auth/password-reset-otp');
  return checkCustomerEmailExists(email);
}

/**
 * Step 2: User sets new password and confirm password. Validates password rules and sends OTP code to email.
 */
export async function sendResetPasswordOtpWithNewPasswordAction(data: {
  email: string;
  password: string;
  confirmPassword: string;
}) {
  const { sendResetPasswordOtpWithNewPassword } = await import('@/lib/auth/password-reset-otp');
  return sendResetPasswordOtpWithNewPassword(data);
}

/**
 * Resends a fresh 6-digit OTP code for password reset.
 */
export async function resendCustomerResetOtpAction(resetTicket: string) {
  const { resendCustomerResetPasswordOtpFlow } = await import('@/lib/auth/password-reset-otp');
  return resendCustomerResetPasswordOtpFlow(resetTicket);
}

/**
 * Step 3: Verifies the 6-digit OTP code and updates password directly in the database.
 */
export async function verifyResetOtpAndSavePasswordAction(data: {
  resetTicket: string;
  otpCode: string;
}) {
  const { verifyOtpAndSavePasswordFlow } = await import('@/lib/auth/password-reset-otp');
  return verifyOtpAndSavePasswordFlow(data);
}

export async function requestPasswordReset(email: string) {
  // Retained for backward-compatibility
  return checkCustomerEmailExistsAction(email);
}

/**
 * Manually unlocks a customer account by clearing failed login attempts.
 */
export async function unlockCustomerAccountAction(identifier: string) {
  if (!identifier) return { error: 'Please enter an email or username.' };
  await clearLoginAttempts(identifier, 'customer');
  return { success: true };
}


