'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { validateFullName, validateEmailAddress } from '@/lib/validations/contact-rules';

const passwordSchema = z
  .string()
  .min(7, 'Password must be at least 7 characters')
  .max(72, 'Password is too long')
  .regex(/[A-Z]/, 'Password must include at least one capital letter')
  .regex(/[a-z]/, 'Password must include at least one lowercase letter')
  .regex(/[0-9]/, 'Password must include at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must include at least one symbol');

const nameSchema = z
  .string()
  .trim()
  .superRefine((v, ctx) => {
    const err = validateFullName(v);
    if (err) ctx.addIssue({ code: 'custom', message: err });
  });

const createUserSchema = z.object({
  full_name: nameSchema,
  email: z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      const err = validateEmailAddress(v);
      if (err) ctx.addIssue({ code: 'custom', message: err });
    }),
  password: passwordSchema,
  role_id: z.string().uuid('Please choose a role'),
});

type RoleRecord = { id: string; name: string; is_system: boolean };

/** Loads the chosen role and works out the system access tier it maps to. */
async function resolveRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  roleId: string,
  requesterRole: string
): Promise<{ role?: RoleRecord; baseRole?: 'admin' | 'sales_staff'; error?: string }> {
  const { data: role, error } = await supabase
    .from('staff_roles')
    .select('id, name, is_system')
    .eq('id', roleId)
    .maybeSingle();
  if (error) {
    return { error: 'Roles are not set up yet. Run supabase/roles_and_users_migration.sql in Supabase first.' };
  }
  if (!role) return { error: 'The selected role no longer exists. Please choose another.' };
  // The built-in Admin role grants full access; everything else is staff-level
  const baseRole = role.is_system ? 'admin' : 'sales_staff';
  if (baseRole === 'admin' && requesterRole !== 'super_admin') {
    return { error: 'Only the Super Admin can give someone the Admin role.' };
  }
  return { role, baseRole };
}

/** Stores the admin-issued temporary password (cleared automatically when the user changes it). */
async function storeTempPassword(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  password: string,
  setBy: string
) {
  const { error } = await supabase
    .from('staff_temp_passwords')
    .upsert({ profile_id: profileId, temp_password: password, set_by: setBy, created_at: new Date().toISOString() }, {
      onConflict: 'profile_id',
    });
  if (error) console.error('Could not store temporary password:', error.message);
}

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

  const supabase = await createClient();
  const resolved = await resolveRole(supabase, parsed.data.role_id, requester.role);
  if (resolved.error || !resolved.role || !resolved.baseRole) return { error: resolved.error };
  const roleId = resolved.role.id;
  const rawRole = resolved.role.name;
  const baseRole = resolved.baseRole;

  const normalizedEmail = parsed.data.email.trim().toLowerCase();

  // Check if a profile with this email already exists (active or soft-deleted)
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingProfile) {
    if ((existingProfile as any).is_deleted || (existingProfile as any).role_title === '[DELETED]') {
      // Re-activate a soft-deleted user with the new role and temporary password
      await supabase
        .from('profiles')
        .update({
          full_name: parsed.data.full_name,
          role: baseRole,
          role_title: rawRole,
          role_id: roleId,
          is_active: true,
          is_deleted: false,
        } as any)
        .eq('id', existingProfile.id);
      try {
        await supabase.from('website_settings').delete().eq('key', `deleted_user_${existingProfile.id}`);
      } catch {}
      const pw = await setAuthPassword(existingProfile.id, parsed.data.password);
      if (pw.error) return { error: pw.error };
      await storeTempPassword(supabase, existingProfile.id, parsed.data.password, requester.id);

      revalidatePath('/travinco_dashboard', 'layout');
      revalidatePath('/travinco_dashboard/users');
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
      role_id: roleId,
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
        role_title: rawRole,
        role_id: roleId,
        is_active: true,
      } as any,
      { onConflict: 'id' }
    );
  }

  // 4. Remember the temporary password so the admin can share it (until the user changes it)
  await storeTempPassword(supabase, newUserId, parsed.data.password, requester.id);

  revalidatePath('/travinco_dashboard', 'layout');
  revalidatePath('/travinco_dashboard/users');
  revalidatePath('/travinco_dashboard/role-management/roles');
  return { id: newUserId };
}

/** Sets a user's sign-in password (service role). */
async function setAuthPassword(profileId: string, password: string): Promise<{ error?: string }> {
  try {
    const serviceClient = createServiceClient();
    const { error } = await serviceClient.auth.admin.updateUserById(profileId, { password });
    if (error) return { error: error.message || 'Could not set the password.' };
    return {};
  } catch {
    return { error: 'Password changes need the Supabase service role key to be configured on the server.' };
  }
}

/** Edits a user's name and role from the Users page. Email stays fixed (it is the sign-in id). */
export async function updateStaffUser(profileId: string, raw: { full_name: string; role_id: string }) {
  const requester = await requireProfile();
  if (requester.role !== 'admin' && requester.role !== 'super_admin') {
    return { error: 'Only administrators can edit users.' };
  }

  const parsed = z.object({ full_name: nameSchema, role_id: z.string().uuid('Please choose a role') }).safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const supabase = await createClient();
  const { data: target } = await supabase.from('profiles').select('id, role, role_id').eq('id', profileId).maybeSingle();
  if (!target) return { error: 'User not found.' };
  if (target.role === 'super_admin') return { error: 'The Super Admin account cannot be changed here.' };
  if (target.role === 'admin' && requester.role !== 'super_admin') {
    return { error: 'Only the Super Admin can change an Admin account.' };
  }

  const roleChanged = (target as { role_id?: string | null }).role_id !== parsed.data.role_id;
  if (roleChanged && requester.id === profileId) return { error: 'You cannot change your own role.' };

  const resolved = await resolveRole(supabase, parsed.data.role_id, requester.role);
  if (resolved.error || !resolved.role || !resolved.baseRole) return { error: resolved.error };

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.full_name.replace(/\s+/g, ' '),
      role_id: resolved.role.id,
      role_title: resolved.role.name,
      // Keep your own tier when editing yourself (admins can't demote themselves)
      ...(requester.id === profileId ? {} : { role: resolved.baseRole }),
    } as any)
    .eq('id', profileId);
  if (error) return { error: 'Could not update the user.' };

  revalidatePath('/travinco_dashboard', 'layout');
  revalidatePath('/travinco_dashboard/users');
  revalidatePath(`/travinco_dashboard/users/${profileId}`);
  revalidatePath('/travinco_dashboard/role-management/roles');
  return {};
}

/**
 * Issues a new temporary password for a user (e.g. they forgot theirs).
 * The admin sees it on the Users page until the user changes it.
 */
export async function resetStaffTempPassword(profileId: string, password: string) {
  const requester = await requireProfile();
  if (requester.role !== 'admin' && requester.role !== 'super_admin') {
    return { error: 'Only administrators can reset passwords.' };
  }
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please choose a stronger password.' };

  const supabase = await createClient();
  const { data: target } = await supabase.from('profiles').select('id, role').eq('id', profileId).maybeSingle();
  if (!target) return { error: 'User not found.' };
  if (target.role === 'super_admin') return { error: 'The Super Admin password cannot be reset here.' };
  if (target.role === 'admin' && requester.role !== 'super_admin') {
    return { error: 'Only the Super Admin can reset an Admin password.' };
  }

  // Order matters: changing the password clears any old temp entry (DB trigger), then the new one is stored
  const pw = await setAuthPassword(profileId, parsed.data);
  if (pw.error) return { error: pw.error };
  await storeTempPassword(supabase, profileId, parsed.data, requester.id);

  revalidatePath('/travinco_dashboard/users');
  return { success: true };
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
  return { success: true };
}
