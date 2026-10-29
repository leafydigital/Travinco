'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(7, 'Password must be at least 7 characters')
      .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
      .regex(/[a-z]/, 'Password must include at least one lowercase letter')
      .regex(/[0-9]/, 'Password must include at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must include at least one symbol'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export async function resetStaffPasswordAction(data: {
  password: string;
  confirmPassword: string;
}) {
  const profile = await requireProfile();

  const parsed = resetPasswordSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form fields.' };
  }

  const supabase = await createClient();

  // 1. Try standard Supabase Auth updateUser for the logged-in session
  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (!updateError) {
    return { success: true };
  }

  // 2. Fallback to service role client if session token update had an issue
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createServiceClient } = await import('@/lib/supabase/service');
      const serviceClient = createServiceClient();
      const { error: adminError } = await serviceClient.auth.admin.updateUserById(
        profile.id,
        { password: parsed.data.password }
      );
      if (!adminError) {
        return { success: true };
      }
    } catch (err) {
      console.error('Service role password reset fallback error:', err);
    }
  }

  return {
    error: updateError?.message || 'Failed to update password. Please try again.',
  };
}

export async function signOut() {
  try {
    const { createAdminClient, ADMIN_AUTH_COOKIE } = await import('@/lib/supabase/server');
    const { cookies } = await import('next/headers');
    const supabase = await createAdminClient();

    // Fast timeout race to ensure user is redirected without lag
    await Promise.race([
      supabase.auth.signOut(),
      new Promise((resolve) => setTimeout(resolve, 600)),
    ]);

    // Explicitly invalidate admin cookies
    const cookieStore = await cookies();
    cookieStore.delete(ADMIN_AUTH_COOKIE);
    for (let i = 0; i <= 4; i++) {
      cookieStore.delete(`${ADMIN_AUTH_COOKIE}.${i}`);
    }
  } catch (err) {
    console.warn('SignOut server error caught:', err);
  }
  redirect('/app');
}
