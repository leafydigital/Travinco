'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireProfile, type CurrentProfile } from '@/lib/supabase/auth-helpers';
import {
  USERS_SHEET_HEADERS,
  USERS_SHEET_TAB,
  archiveRows,
  hardDeleteErrorMessage,
} from '@/lib/hard-delete';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { validateFullName, validateEmailAddress } from '@/lib/validations/contact-rules';
import { staffUsernameSchema, staffPhoneSchema, findStaffIdentityConflict } from '@/lib/validations/staff-account';

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
  username: staffUsernameSchema,
  phone: staffPhoneSchema,
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
  _supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  password: string,
  setBy: string
) {
  // Callers have already verified the requester is an admin
  const { error } = await createServiceClient()
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
  const username = parsed.data.username;
  const phone = parsed.data.phone;

  // Check if a profile with this email already exists (active or soft-deleted)
  // '*' so the is_deleted / role_title checks below see those columns
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingProfile) {
    if ((existingProfile as any).is_deleted || (existingProfile as any).role_title === '[DELETED]') {
      const conflict = await findStaffIdentityConflict(createServiceClient(), { username, excludeId: existingProfile.id });
      if (conflict) return { error: conflict };
      // Re-activate a soft-deleted user with the new role and temporary password
      await supabase
        .from('profiles')
        .update({
          full_name: parsed.data.full_name,
          username,
          phone,
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

  const conflict = await findStaffIdentityConflict(createServiceClient(), { username });
  if (conflict) return { error: conflict };

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
      username,
      phone,
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
        username,
        phone,
        is_active: true,
      } as any)
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
        username,
        phone,
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

/** Edits a user's name, username, phone and role from the Users page. Email stays fixed. */
export async function updateStaffUser(
  profileId: string,
  raw: { full_name: string; username: string; phone: string; role_id: string }
) {
  const requester = await requireProfile();
  if (requester.role !== 'admin' && requester.role !== 'super_admin') {
    return { error: 'Only administrators can edit users.' };
  }

  const parsed = z
    .object({
      full_name: nameSchema,
      username: staffUsernameSchema,
      phone: staffPhoneSchema,
      role_id: z.string().uuid('Please choose a role'),
    })
    .safeParse(raw);
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

  const conflict = await findStaffIdentityConflict(createServiceClient(), {
    username: parsed.data.username,
    excludeId: profileId,
  });
  if (conflict) return { error: conflict };

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.full_name.replace(/\s+/g, ' '),
      username: parsed.data.username,
      phone: parsed.data.phone,
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

/** Was this profile soft-deleted by the old delete (before deletes became permanent)? */
function isSoftDeleted(p: Record<string, any>, markerIds: Set<string>) {
  return p.is_deleted === true || p.role_title === '[DELETED]' || markerIds.has(p.id);
}

/**
 * Saves the users to the Google Sheet "Users" tab, then permanently removes
 * their profile and sign-in account (so the same email can be used again).
 */
async function archiveAndDeleteUsers(
  requester: CurrentProfile,
  targets: Record<string, any>[]
): Promise<{ error?: string; deleted: number }> {
  const supabase = await createClient();
  const { data: roles } = await supabase.from('staff_roles').select('id, name');
  const roleNames = new Map((roles ?? []).map((r) => [r.id as string, r.name as string]));

  const deletedAt = new Date().toISOString();
  const deletedBy = requester.full_name || requester.email;
  const archiveError = await archiveRows(
    USERS_SHEET_TAB,
    USERS_SHEET_HEADERS,
    targets.map((u) => [
      u.id,
      u.full_name ?? null,
      u.username ?? null,
      u.email ?? null,
      u.phone ?? null,
      (u.role_id && roleNames.get(u.role_id)) || (u.role_title !== '[DELETED]' ? u.role_title : null) || u.role || null,
      u.is_deleted || u.role_title === '[DELETED]' ? 'Deleted earlier' : u.is_active ? 'Active' : 'Deactivated',
      u.created_at ?? null,
      deletedAt,
      deletedBy,
    ])
  );
  if (archiveError) return { error: archiveError, deleted: 0 };

  let deleted = 0;
  for (const u of targets) {
    const { error } = await supabase.rpc('hard_delete_staff_user', { p_id: u.id });
    if (error) {
      return {
        error: `${deleted > 0 ? `${deleted} deleted, then: ` : ''}${hardDeleteErrorMessage(error)}`,
        deleted,
      };
    }
    deleted++;
    // Legacy per-user markers
    await supabase
      .from('website_settings')
      .delete()
      .in('key', [`staff_perms_${u.id}`, `custom_role_${u.id}`, `deleted_user_${u.id}`]);
  }
  return { deleted };
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
  const { data: target } = await supabase.from('profiles').select('*').eq('id', profileId).maybeSingle();
  if (!target) return { error: 'Staff member not found.' };
  if (target.role === 'super_admin') return { error: 'Super Admin accounts cannot be deleted.' };
  if (target.role === 'admin' && requester.role !== 'super_admin') {
    return { error: 'Only the Super Admin can delete Admin accounts.' };
  }

  const res = await archiveAndDeleteUsers(requester, [target]);
  if (res.error) return { error: res.error };

  revalidatePath('/travinco_dashboard', 'layout');
  revalidatePath('/travinco_dashboard/users');
  return { success: true };
}

/**
 * One-off clean-up: users deleted before deletes became permanent are still in
 * the database. Saves them to the "Users" sheet and removes them for good.
 */
export async function purgeSoftDeletedUsers(): Promise<{ error?: string; count?: number }> {
  const requester = await requireProfile();
  if (requester.role !== 'admin' && requester.role !== 'super_admin') {
    return { error: 'Only administrators can delete staff accounts.' };
  }

  const supabase = await createClient();
  const [{ data: profiles }, { data: markers }] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('website_settings').select('key').like('key', 'deleted_user_%'),
  ]);
  const markerIds = new Set((markers ?? []).map((m) => m.key.replace('deleted_user_', '')));
  const targets = (profiles ?? []).filter(
    (p: any) =>
      isSoftDeleted(p, markerIds) &&
      p.id !== requester.id &&
      p.role !== 'super_admin' &&
      !(p.role === 'admin' && requester.role !== 'super_admin')
  );
  if (targets.length === 0) return { count: 0 };

  const res = await archiveAndDeleteUsers(requester, targets);
  revalidatePath('/travinco_dashboard/users');
  return res.error ? { error: res.error, count: res.deleted } : { count: res.deleted };
}
