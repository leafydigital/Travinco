'use server';

import { createClient } from '@/lib/supabase/server';
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
      // This flag is what migration 021's triggers check — it's what
      // keeps a customer signup from also creating a staff profiles
      // row with admin-panel access. Never remove it from this call.
      data: {
        full_name: parsed.data.full_name,
        is_customer_signup: 'true',
      },
    },
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes('already registered') || message.includes('already exists') || message.includes('user already')) {
      return { error: 'An account with this email already exists. Try logging in instead.' };
    }
    // Logged server-side so the real Supabase error (rate limit, SMTP
    // failure, misconfiguration, etc.) is visible in Vercel's function
    // logs — the message shown to the visitor stays generic on purpose.
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
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (error.message.toLowerCase().includes('email not confirmed')) {
      return { error: 'Please confirm your email first — check your inbox for the link we sent when you signed up.' };
    }
    return { error: 'Incorrect email or password.' };
  }

  return {};
}

export async function logOutCustomer() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
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
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be logged in.' };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: 'Could not update your password. Please try again.' };

  return {};
}

export async function requestPasswordReset(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/account/reset-password`,
  });

  // Never reveal whether the email exists — same response either way,
  // so this can't be used to check which emails have accounts.
  if (error) {
    return { error: 'Could not send the reset link. Please try again.' };
  }
  return {};
}
