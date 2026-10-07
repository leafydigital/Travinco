'use server';

import { createClient } from '@/lib/supabase/server';
import { requireCustomer } from '@/lib/supabase/customer-auth-helpers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const signupSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  email: z
    .string()
    .email('Enter a valid email')
    .refine((email) => email.toLowerCase().endsWith('@gmail.com'), {
      message: 'Only @gmail.com email addresses are accepted',
    }),
  password: z
    .string()
    .min(7, 'Password must be at least 7 characters')
    .regex(/[A-Z]/, 'Password must include at least one capital letter')
    .regex(/[a-z]/, 'Password must include at least one lowercase letter')
    .regex(/[0-9]/, 'Password must include at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must include at least one symbol'),
});

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export async function signUpCustomer(raw: unknown) {
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // This metadata flag triggers migration 021's logic:
      // creates customer_accounts row and skips creating staff profiles row.
      data: {
        full_name: parsed.data.full_name,
        is_customer_signup: 'true',
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
      return { error: 'An account with this email already exists. Try logging in instead.' };
    }
    console.error('signUpCustomer failed:', error.message);
    return { error: 'Could not create your account. Please try again.' };
  }

  return {};
}

export async function logInCustomer(raw: unknown) {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  const supabase = await createClient();
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
    return { error: 'Incorrect email or password.' };
  }

  // Ensure this authenticated user has a corresponding customer_accounts record.
  // Prevents staff users from logging in through customer portal and vice versa.
  const { data: customerAccount } = await supabase
    .from('customer_accounts')
    .select('id')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (!customerAccount) {
    await supabase.auth.signOut();
    return {
      error:
        'This login is for customer accounts only. If you are a staff member, please use the staff portal at /login.',
    };
  }

  return {};
}

export async function logOutCustomer() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/account/login');
}

const changePasswordSchema = z.object({
  password: z
    .string()
    .min(7, 'Password must be at least 7 characters')
    .regex(/[A-Z]/, 'Password must include at least one capital letter')
    .regex(/[a-z]/, 'Password must include at least one lowercase letter')
    .regex(/[0-9]/, 'Password must include at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must include at least one symbol'),
});

export async function changeCustomerPassword(raw: unknown) {
  // Enforces that the session is a verified customer account
  await requireCustomer();

  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: 'Could not update your password. Please try again.' };

  return {};
}

export async function requestPasswordReset(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/account/reset-password`,
  });

  // Never reveal whether the email exists — same response either way
  if (error) {
    console.error('requestPasswordReset failed:', error.message);
  }
  return {};
}
