'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

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
  role: z.enum(['admin', 'sales_staff', 'accounts_staff']),
});

/**
 * Creates a new staff account. Restricted to super_admin — checked here
 * in application code AND backed by the "only super_admin can change
 * roles / manage other profiles" RLS policy on public.profiles (see
 * migration 010), so this can't be bypassed even if this check were
 * ever accidentally removed.
 */
export async function createStaffUser(raw: unknown) {
  const requester = await requireProfile();
  if (requester.role !== 'super_admin') {
    return { error: 'Only the main admin can create new users.' };
  }

  const parsed = createUserSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  const serviceClient = createServiceClient();

  // Created via the service-role client's admin API, not the public
  // signUp() flow — this deliberately does NOT set the
  // is_customer_signup metadata flag, so migration 021's trigger
  // creates a normal staff profiles row for it, same as any other
  // staff account.
  const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name },
  });

  if (createError || !newUser.user) {
    return { error: createError?.message || 'Could not create the user.' };
  }

  // The auth trigger creates the profiles row with the default role
  // (sales_staff) — update it to whatever was actually selected here.
  const { error: roleError } = await serviceClient
    .from('profiles')
    .update({ role: parsed.data.role })
    .eq('id', newUser.user.id);

  if (roleError) {
    return { error: 'User created, but could not set their role. Edit them to fix it.' };
  }

  revalidatePath('/admin/users');
  return { id: newUser.user.id };
}

export async function updateStaffRole(profileId: string, role: string) {
  const requester = await requireProfile();
  if (requester.role !== 'super_admin') {
    return { error: 'Only the main admin can change roles.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ role }).eq('id', profileId);
  if (error) return { error: 'Could not update role.' };

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${profileId}`);
  return {};
}

export async function setStaffActive(profileId: string, isActive: boolean) {
  const requester = await requireProfile();
  if (requester.role !== 'super_admin') {
    return { error: 'Only the main admin can deactivate users.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', profileId);
  if (error) return { error: 'Could not update status.' };

  revalidatePath('/admin/users');
  return {};
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

  revalidatePath(`/admin/users/${profileId}`);
  return {};
}
