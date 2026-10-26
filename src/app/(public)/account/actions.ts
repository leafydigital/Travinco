'use server';

import { createCustomerClient, CUSTOMER_AUTH_COOKIE } from '@/lib/supabase/server';
import { requireCustomer } from '@/lib/supabase/customer-auth-helpers';
import {
  checkLoginLockout,
  recordFailedLoginAttempt,
  clearLoginAttempts,
  MAX_LOGIN_ATTEMPTS,
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

const signupSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
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
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Step 1 of OTP Signup: Validates name, email, password, confirm password,
 * checks for duplicate email, and sends a 6-digit OTP to the user's Gmail.
 */
export async function initiateCustomerSignup(raw: unknown): Promise<InitiateSignupResult> {
  const parsed = initiateSignupSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }
  return initiateCustomerSignupFlow({
    fullName: parsed.data.full_name,
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
      // This metadata flag triggers migration 021/039 logic:
      // creates customer_accounts row and skips creating staff profiles row.
      data: {
        full_name: parsed.data.full_name,
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
 * Step 1 of OTP Login: Validates email and password, sends a 6-digit OTP to the registered email.
 */
export async function initiateCustomerLogin(raw: unknown): Promise<InitiateLoginResult> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }
  return initiateCustomerLoginFlow(parsed.data.email, parsed.data.password);
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
  if (lockoutStatus.isLocked) {
    const mins = lockoutStatus.minutesRemaining || 15;
    return {
      error: `Account is temporarily locked due to 5 consecutive failed login attempts. Please try again in ${mins} minute${mins === 1 ? '' : 's'} or use "Forgot password?".`,
      isLocked: true,
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
      await supabase.auth.signOut();
      return {
        error:
          'This login is for customer accounts only. If you are a staff member, please use the staff portal at /travinco_admin_login.',
      };
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

export async function requestPasswordReset(email: string) {
  const supabase = await createCustomerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/account/reset-password`,
  });

  // Never reveal whether the email exists — same response either way
  if (error) {
    console.error('requestPasswordReset failed:', error.message);
  }
  return {};
}
