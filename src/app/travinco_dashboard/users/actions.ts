'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { saveStaffPagePermissions } from '@/app/travinco_dashboard/role-management/actions';

const MODULES = [
  'packages', 'destinations', 'enquiries', 'offers', 'gallery', 'blog', 'settings', 'users',
] as const;

const createUserSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  password: z
    .string()
    .min(7, 'Password must be at least 7 characters')
    .regex(/[A-Z]/, 'Password must include at least one capital letter')
    .regex(/[a-z]/, 'Password must include at least one lowercase letter')
    .regex(/[0-9]/, 'Password must include at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must include at least one symbol'),
  role: z.string().min(1, 'Role name is required'),
  permissions: z.array(z.string()).optional(),
});

/**
 * Creates a new staff account.
 */
export async function createStaffUser(raw: unknown) {
  const requester = await requireProfile();
  if (requester.role !== 'admin' && requester.role !== 'super_admin') {
    return { error: 'Only administrators can create new users.' };
  }

  const parsed = createUserSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  const rawRole = parsed.data.role.trim();
  const lowerRole = rawRole.toLowerCase();

  let baseRole: 'admin' | 'sales_staff' | 'accounts_staff' = 'sales_staff';
  if (lowerRole === 'admin' || lowerRole === 'administrator') {
    baseRole = 'admin';
  } else if (lowerRole.includes('account') || lowerRole.includes('finance')) {
    baseRole = 'accounts_staff';
  }

  if (baseRole === 'admin' && requester.role !== 'super_admin') {
    return { error: 'Only the Super Admin can create Admin accounts.' };
  }

  const supabase = await createClient();
  const normalizedEmail = parsed.data.email.trim().toLowerCase();

  // Check if a profile with this email already exists (active or soft-deleted)
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingProfile) {
    if ((existingProfile as any).is_deleted || (existingProfile as any).role_title === '[DELETED]') {
      // Re-activate soft-deleted user
      await supabase
        .from('profiles')
        .update({
          full_name: parsed.data.full_name,
          role: baseRole,
          role_title: rawRole,
          is_active: true,
          is_deleted: false,
        } as any)
        .eq('id', existingProfile.id);

      try {
        await supabase.from('website_settings').upsert(
          {
            key: `custom_role_${existingProfile.id}`,
            value: { role_title: rawRole },
          },
          { onConflict: 'key' }
        );
      } catch {}

      revalidatePath('/travinco_dashboard/users');
      revalidatePath('/travinco_dashboard/role-management/page-access');
      return { id: existingProfile.id };
    }
    return { error: 'A staff member with this email address already exists.' };
  }

  let newUserId: string | null = null;
  let creationErrorMessage: string | null = null;

  // 1. Attempt user creation via service-role admin API (if a valid service key is present)
  try {
    const serviceClient = createServiceClient();
    const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
      email: normalizedEmail,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.full_name, role_title: rawRole },
    });

    if (!createError && newUser?.user?.id) {
      newUserId = newUser.user.id;
    } else if (createError) {
      const isApiKeyIssue =
        createError.status === 401 ||
        createError.message?.toLowerCase().includes('api key') ||
        createError.message?.toLowerCase().includes('unregistered');

      if (!isApiKeyIssue) {
        creationErrorMessage = createError.message;
      }
    }
  } catch {
    // Service key might be missing or throwing on init
  }

  // 2. If service-role key is unregistered / invalid, create via isolated anonymous client
  if (!newUserId && !creationErrorMessage) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const anonAuthClient = createSupabaseClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: authData, error: signUpError } = await anonAuthClient.auth.signUp({
      email: normalizedEmail,
      password: parsed.data.password,
      options: {
        data: {
          full_name: parsed.data.full_name,
          role_title: rawRole,
        },
      },
    });

    if (signUpError || !authData.user) {
      return { error: signUpError?.message || 'Could not create the user account.' };
    }

    if (authData.user.identities && authData.user.identities.length === 0) {
      return { error: 'An account with this email address is already registered in the system.' };
    }

    newUserId = authData.user.id;

    // Ensure staff account is confirmed via RPC so login never encounters 'Email not confirmed'
    try {
      await supabase.rpc('confirm_staff_email', { p_email: normalizedEmail });
    } catch {}
  } else if (creationErrorMessage) {
    return { error: creationErrorMessage };
  }

  if (!newUserId) {
    return { error: 'Could not create the user.' };
  }

  // 3. Update public.profiles with role, custom title, and is_deleted: false
  let { error: profileUpdateError } = await supabase
    .from('profiles')
    .update({
      role: baseRole,
      role_title: rawRole,
      full_name: parsed.data.full_name,
      is_active: true,
      is_deleted: false,
    } as any)
    .eq('id', newUserId);

  if (
    profileUpdateError &&
    (profileUpdateError.message?.includes('is_deleted') ||
      profileUpdateError.message?.includes('role_title'))
  ) {
    const retry = await supabase
      .from('profiles')
      .update({
        role: baseRole,
        full_name: parsed.data.full_name,
        is_active: true,
      })
      .eq('id', newUserId);
    profileUpdateError = retry.error;
  }

  if (profileUpdateError) {
    // If update didn't find the row yet (due to trigger delay), perform an upsert
    await supabase.from('profiles').upsert(
      {
        id: newUserId,
        email: normalizedEmail,
        full_name: parsed.data.full_name,
        role: baseRole,
        is_active: true,
      },
      { onConflict: 'id' }
    );
  }

  // Persist custom role title in website_settings fallback
  try {
    await supabase.from('website_settings').upsert(
      {
        key: `custom_role_${newUserId}`,
        value: { role_title: rawRole },
      },
      { onConflict: 'key' }
    );
  } catch (roleErr) {
    console.error('Failed to save custom role in website_settings:', roleErr);
  }

  // 4. Save assigned page access permissions if provided
  if (parsed.data.permissions && parsed.data.permissions.length >= 0) {
    try {
      await saveStaffPagePermissions(newUserId, parsed.data.permissions);
    } catch (permSaveErr) {
      console.error('Failed to save page access permissions during user creation:', permSaveErr);
    }
  }

  revalidatePath('/travinco_dashboard', 'layout');
  revalidatePath('/travinco_dashboard/users');
  revalidatePath('/travinco_dashboard/role-management/page-access');
  return { id: newUserId };
}

export async function updateStaffRole(profileId: string, role: string) {
  const requester = await requireProfile();
  if (requester.role !== 'admin' && requester.role !== 'super_admin') {
    return { error: 'Only administrators can change roles.' };
  }
  if (requester.id === profileId) {
    return { error: 'You cannot change your own role.' };
  }

  const rawRole = role.trim();
  const lowerRole = rawRole.toLowerCase();

  let baseRole: 'admin' | 'sales_staff' | 'accounts_staff' = 'sales_staff';
  if (lowerRole === 'admin' || lowerRole === 'administrator') {
    baseRole = 'admin';
  } else if (lowerRole.includes('account') || lowerRole.includes('finance')) {
    baseRole = 'accounts_staff';
  }

  if (baseRole === 'admin' && requester.role !== 'super_admin') {
    return { error: 'Only the Super Admin can assign the Admin role.' };
  }

  const supabase = await createClient();
  let { error } = await supabase
    .from('profiles')
    .update({ role_title: rawRole, role: baseRole })
    .eq('id', profileId);

  if (error) {
    const fallback = await supabase.from('profiles').update({ role: baseRole }).eq('id', profileId);
    if (fallback.error) return { error: 'Could not update role: ' + (error.message || fallback.error.message) };
  }

  // Persist custom role title in website_settings fallback
  try {
    await supabase.from('website_settings').upsert(
      {
        key: `custom_role_${profileId}`,
        value: { role_title: rawRole },
      },
      { onConflict: 'key' }
    );
  } catch (roleErr) {
    console.error('Failed to update custom role in website_settings:', roleErr);
  }

  revalidatePath('/travinco_dashboard', 'layout');
  revalidatePath('/travinco_dashboard/users');
  revalidatePath(`/travinco_dashboard/users/${profileId}`);
  revalidatePath('/travinco_dashboard/role-management/page-access');
  return {};
}

export async function setStaffActive(profileId: string, isActive: boolean) {
  const requester = await requireProfile();
  if (requester.role !== 'admin' && requester.role !== 'super_admin') {
    return { error: 'Only administrators can activate or deactivate users.' };
  }
  if (requester.id === profileId && !isActive) {
    return { error: 'You cannot deactivate your own account.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', profileId);
  if (error) return { error: 'Could not update status.' };

  revalidatePath('/travinco_dashboard/users');
  revalidatePath('/travinco_dashboard/role-management/page-access');
  return { success: true };
}

export async function deleteStaffUser(profileId: string) {
  const requester = await requireProfile();
  // Delete access only allowed to admin only
  if (requester.role !== 'admin' && requester.role !== 'super_admin') {
    return { error: 'Only administrators can delete staff accounts.' };
  }
  if (requester.id === profileId) {
    return { error: 'You cannot delete your own account.' };
  }

  const supabase = await createClient();

  // Fetch target profile
  const { data: targetProfile, error: fetchErr } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', profileId)
    .single();

  if (fetchErr || !targetProfile) {
    return { error: 'Staff member not found.' };
  }

  if (targetProfile.role === 'super_admin') {
    return { error: 'Super Admin accounts cannot be deleted.' };
  }

  if (targetProfile.role === 'admin' && requester.role !== 'super_admin') {
    return { error: 'Only the Super Admin can delete Admin accounts.' };
  }

  // 1. Revoke page permissions so user has no access
  await supabase.from('staff_permissions').delete().eq('profile_id', profileId);
  try {
    await supabase.from('website_settings').delete().eq('key', `staff_perms_${profileId}`);
    await supabase.from('website_settings').delete().eq('key', `custom_role_${profileId}`);
  } catch {}

  // 2. SOFT DELETE fallback in website_settings (guarantees user is immediately and permanently hidden from tables)
  try {
    await supabase.from('website_settings').upsert(
      {
        key: `deleted_user_${profileId}`,
        value: { is_deleted: true, deleted_at: new Date().toISOString() },
      },
      { onConflict: 'key' }
    );
  } catch (wsErr) {
    console.error('Failed to record deleted user in website_settings:', wsErr);
  }

  // 3. SOFT DELETE on profiles table: update is_deleted = true, is_active = false
  // (Data is NOT removed from database)
  let { error: softDeleteErr } = await supabase
    .from('profiles')
    .update({
      is_deleted: true,
      is_active: false,
    } as any)
    .eq('id', profileId);

  if (softDeleteErr && softDeleteErr.message?.includes('is_deleted')) {
    // If migration is pending in Supabase, deactivate account
    const fallback = await supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('id', profileId);
    if (fallback.error) return { error: fallback.error.message };
  } else if (softDeleteErr) {
    return { error: softDeleteErr.message || 'Could not soft-delete staff member.' };
  }

  revalidatePath('/travinco_dashboard', 'layout');
  revalidatePath('/travinco_dashboard/users');
  revalidatePath('/travinco_dashboard/role-management/page-access');
  return { success: true };
}

/**
 * Replaces all of a staff member's per-module permission rows in one
 * call. permissions is keyed by module name; a module left out of the
 * map is deleted (falls back to role-based access only).
 */
export async function setStaffPermissions(
  profileId: string,
  permissions: Record<string, { can_view: boolean; can_edit: boolean }>
) {
  const requester = await requireProfile();
  if (requester.role !== 'super_admin') {
    return { error: 'Only the main admin can change permissions.' };
  }

  const supabase = await createClient();

  await supabase.from('staff_permissions').delete().eq('profile_id', profileId);

  const rows = MODULES.filter((m) => Boolean(permissions[m])).map((m) => {
    const entry = permissions[m]!;
    return {
      profile_id: profileId,
      module: m,
      can_view: entry.can_view,
      can_edit: entry.can_edit,
    };
  });

  if (rows.length > 0) {
    const { error } = await supabase.from('staff_permissions').insert(rows);
    if (error) return { error: 'Could not update permissions.' };
  }

  revalidatePath(`/travinco_dashboard/users/${profileId}`);
  return {};
}
