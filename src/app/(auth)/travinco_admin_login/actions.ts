'use server';

import { createAdminClient, createClient } from '@/lib/supabase/server';
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
  const rawEmail = formData.get('email');
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  const rawPassword = formData.get('password');
  const password = typeof rawPassword === 'string' ? rawPassword : '';

  const parsed = loginSchema.safeParse({
    email,
    password,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createAdminClient();
  let { data: authData, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error && error.message?.toLowerCase().includes('email not confirmed')) {
    try {
      const { data: confirmed } = await supabase.rpc('confirm_staff_email', {
        p_email: parsed.data.email,
      });

      if (confirmed) {
        // Retry sign-in now that user email is confirmed
        const retry = await supabase.auth.signInWithPassword(parsed.data);
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
    if (error) {
      console.error('Staff login error:', error.message, error.status);
      if (error.message?.toLowerCase().includes('email not confirmed')) {
        return {
          error:
            'This staff email is not confirmed yet. Run the SQL snippet in Supabase SQL editor or click "Confirm User" in Supabase Authentication > Users.',
        };
      }
    }
    return { error: 'Incorrect email or password.' };
  }

  // Verify that the user has a corresponding profiles record (staff/admin)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
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

  // Find staff member's first accessible page so staff without dashboard access land directly on an allowed page
  let defaultDestination = '/travinco_dashboard';
  try {
    const { getStaffPermissions } = await import('@/lib/supabase/auth-helpers');
    const { navForProfile } = await import('@/lib/admin-nav');
    const permissions = await getStaffPermissions(profile.id);
    const accessibleSections = navForProfile(profile, permissions);
    const firstAllowed = accessibleSections.flatMap((s) => s.items)[0]?.href;
    if (firstAllowed) {
      defaultDestination = firstAllowed;
    }
  } catch {}

  const rawRedirect = formData.get('redirectTo');
  const safeRedirect = getSafeRedirectPath(rawRedirect, defaultDestination);

  redirect(safeRedirect);
}

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

export async function checkStaffEmailAction(
  email: string
): Promise<{ success: boolean; fullName?: string; email?: string; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return { success: false, error: 'Please enter a valid staff email address.' };
  }

  const supabase = await createClient();

  // 1. First attempt: call check_staff_email RPC (bypasses RLS)
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('check_staff_email', {
      p_email: normalizedEmail,
    });

    if (!rpcError && rpcData) {
      if (rpcData.exists) {
        return {
          success: true,
          fullName: rpcData.full_name || 'Staff Member',
          email: rpcData.email || normalizedEmail,
        };
      }
      return { success: false, error: rpcData.error || 'No staff account found with this email address.' };
    }
  } catch (err) {
    console.warn('check_staff_email RPC call skipped:', err);
  }

  // 2. Second attempt: call confirm_staff_email RPC (which is ALREADY active in the remote DB)
  try {
    const { data: isStaff, error: confirmErr } = await supabase.rpc('confirm_staff_email', {
      p_email: normalizedEmail,
    });

    if (!confirmErr && isStaff === true) {
      return {
        success: true,
        fullName: 'Staff Member',
        email: normalizedEmail,
      };
    }
    if (!confirmErr && isStaff === false) {
      return {
        success: false,
        error: 'No staff account found with this email address.',
      };
    }
  } catch (err) {
    console.warn('confirm_staff_email RPC call skipped:', err);
  }

  // 3. Third attempt: query profiles directly in case RLS permits it
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, is_active, is_deleted')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (profile) {
      if (profile.is_deleted) {
        return { success: false, error: 'This staff account has been deleted.' };
      }
      if (!profile.is_active) {
        return {
          success: false,
          error: 'This staff account has been deactivated. Please contact your administrator.',
        };
      }
      return {
        success: true,
        fullName: profile.full_name || 'Staff Member',
        email: profile.email,
      };
    }
  } catch {}

  return { success: false, error: 'No staff account found with this email address.' };
}

export async function resetStaffPasswordDirectAction(data: {
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<{ success?: boolean; error?: string }> {
  const normalizedEmail = data.email.trim().toLowerCase();
  const parsed = resetPasswordSchema.safeParse({
    password: data.password,
    confirmPassword: data.confirmPassword,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid password format.' };
  }

  const supabase = await createClient();

  // 1. Attempt direct update via reset_staff_password RPC function (security definer)
  try {
    const { data: rpcRes, error: rpcError } = await supabase.rpc('reset_staff_password', {
      p_email: normalizedEmail,
      p_new_password: parsed.data.password,
    });

    if (!rpcError && rpcRes) {
      if (typeof rpcRes === 'boolean' && rpcRes === true) {
        return { success: true };
      }
      if (typeof rpcRes === 'object') {
        if (rpcRes.success) return { success: true };
        if (rpcRes.error) return { error: rpcRes.error };
      }
    }
    if (rpcError && !rpcError.message?.includes('does not exist')) {
      return { error: rpcError.message };
    }
  } catch (err) {
    console.warn('reset_staff_password RPC call skipped:', err);
  }

  // 2. Fallback: update via Supabase Service Client admin API (if configured)
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createServiceClient } = await import('@/lib/supabase/service');
      const serviceClient = createServiceClient();
      const { data: userLookup } = await serviceClient.auth.admin.listUsers();
      const targetUser = userLookup?.users?.find(
        (u) => u.email?.toLowerCase() === normalizedEmail
      );
      if (targetUser) {
        const { error: adminError } = await serviceClient.auth.admin.updateUserById(
          targetUser.id,
          { password: parsed.data.password }
        );
        if (!adminError) {
          return { success: true };
        }
      }
    } catch (serviceErr) {
      console.warn('Service client fallback skipped:', serviceErr);
    }
  }

  return {
    error: 'Please run migration 036_reset_staff_password.sql in the Supabase SQL Editor to enable direct password resetting.',
  };
}

export async function completeStaffPasswordReset(data: {
  password: string;
  confirmPassword: string;
  email?: string;
}): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const targetEmail = data.email || userData?.user?.email;

  if (!targetEmail) {
    return { error: 'Please specify your staff email address.' };
  }

  return resetStaffPasswordDirectAction({
    email: targetEmail,
    password: data.password,
    confirmPassword: data.confirmPassword,
  });
}
