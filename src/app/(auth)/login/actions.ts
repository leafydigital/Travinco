'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginState = {
  error?: string;
};

function getSafeRedirectPath(rawPath: unknown, fallback: string): string {
  if (
    typeof rawPath !== 'string' ||
    !rawPath.startsWith('/') ||
    rawPath.startsWith('//') ||
    rawPath.includes('\\')
  ) {
    return fallback;
  }
  return rawPath;
}

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data: authData, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !authData?.user) {
    if (error) {
      console.error('Staff login error:', error.message, error.status);
    }
    return { error: 'Incorrect email or password.' };
  }

  // Verify that the user has a corresponding profiles record (staff/admin)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    // Session belongs to customer account or non-staff user
    await supabase.auth.signOut();
    return {
      error:
        'That account is a customer account, not a staff account — please sign in with your staff email.',
    };
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    return {
      error: 'This staff account has been deactivated. Contact your administrator.',
    };
  }

  const rawRedirect = formData.get('redirectTo');
  const safeRedirect = getSafeRedirectPath(rawRedirect, '/admin');

  redirect(safeRedirect);
}
