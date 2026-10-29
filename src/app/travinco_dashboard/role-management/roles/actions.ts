'use server';

import { revalidatePath } from 'next/cache';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRolePages, validateRoleName } from '@/lib/staff-roles';

type Result = { error?: string; id?: string };

async function requireAdmin() {
  const caller = await requireProfile();
  if (caller.role !== 'admin' && caller.role !== 'super_admin') {
    return { caller, error: 'Only administrators can manage roles.' };
  }
  return { caller, error: null as string | null };
}

const MISSING_TABLE_HINT =
  'Roles are not set up in the database yet. Run supabase/roles_and_users_migration.sql in the Supabase SQL Editor.';

function friendlyDbError(err: { code?: string; message?: string } | null, fallback: string) {
  if (!err) return fallback;
  if (err.code === '23505') return 'A role with this name already exists.';
  if (err.code === '23503') return 'This role is still assigned to users. Move them to another role first.';
  if (err.code === '42P01' || err.message?.includes('staff_roles')) return MISSING_TABLE_HINT;
  return fallback;
}

function revalidateRoles() {
  revalidatePath('/travinco_dashboard', 'layout');
  revalidatePath('/travinco_dashboard/role-management/roles');
  revalidatePath('/travinco_dashboard/users');
}

export async function createRole(input: { name: string; pages: string[] }): Promise<Result> {
  const { caller, error } = await requireAdmin();
  if (error) return { error };

  const nameError = validateRoleName(input.name);
  if (nameError) return { error: nameError };
  const pages = sanitizeRolePages(input.pages ?? []);
  if (pages.length === 0) return { error: 'Select at least one page this role can access.' };

  const supabase = await createClient();
  const { data, error: dbError } = await supabase
    .from('staff_roles')
    .insert({ name: input.name.trim().replace(/\s+/g, ' '), pages, created_by: caller.id })
    .select('id')
    .single();

  if (dbError || !data) return { error: friendlyDbError(dbError, 'Could not create the role.') };
  revalidateRoles();
  return { id: data.id };
}

export async function updateRole(id: string, input: { name: string; pages: string[] }): Promise<Result> {
  const { error } = await requireAdmin();
  if (error) return { error };

  const nameError = validateRoleName(input.name);
  if (nameError) return { error: nameError };
  const pages = sanitizeRolePages(input.pages ?? []);
  if (pages.length === 0) return { error: 'Select at least one page this role can access.' };

  const supabase = await createClient();
  const { data: existing } = await supabase.from('staff_roles').select('id, is_system').eq('id', id).maybeSingle();
  if (!existing) return { error: 'Role not found.' };
  if (existing.is_system) return { error: 'The built-in Admin role cannot be edited.' };

  const name = input.name.trim().replace(/\s+/g, ' ');
  const { error: dbError } = await supabase.from('staff_roles').update({ name, pages }).eq('id', id);
  if (dbError) return { error: friendlyDbError(dbError, 'Could not update the role.') };

  // Keep the role name shown next to each user in step
  await supabase.from('profiles').update({ role_title: name }).eq('role_id', id);

  revalidateRoles();
  return { id };
}

export async function deleteRole(id: string): Promise<Result> {
  const { error } = await requireAdmin();
  if (error) return { error };

  const supabase = await createClient();
  const { data: existing } = await supabase.from('staff_roles').select('id, name, is_system').eq('id', id).maybeSingle();
  if (!existing) return { error: 'Role not found.' };
  if (existing.is_system) return { error: 'The built-in Admin role cannot be deleted.' };

  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role_id', id)
    .neq('is_deleted', true);
  if (count && count > 0) {
    return {
      error: `${count} user${count === 1 ? ' has' : 's have'} the "${existing.name}" role. Move ${
        count === 1 ? 'them' : 'them'
      } to another role first.`,
    };
  }

  // Soft-deleted users may still point at the role — detach them so the delete can go through
  await supabase.from('profiles').update({ role_id: null }).eq('role_id', id).eq('is_deleted', true);

  const { error: dbError } = await supabase.from('staff_roles').delete().eq('id', id);
  if (dbError) return { error: friendlyDbError(dbError, 'Could not delete the role.') };

  revalidateRoles();
  return { id };
}
