import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { UsersTable } from './users-table';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminUsersPage() {
  const profile = await requireProfile();
  if (profile.role !== 'admin' && profile.role !== 'super_admin') {
    redirect('/travinco_dashboard?error=unauthorized');
  }

  const supabase = await createClient();
  const [{ data: allUsers }, { data: roleSettings }, { data: deletedSettings }, rolesRes, tempRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('website_settings')
      .select('key, value')
      .like('key', 'custom_role_%'),
    supabase
      .from('website_settings')
      .select('key')
      .like('key', 'deleted_user_%'),
    supabase.from('staff_roles').select('id, name, pages, is_system').order('is_system', { ascending: false }).order('name'),
    // Admin-only table; read with the service role after the admin check above so a
    // missing/misconfigured RLS policy can't silently hide every password
    createServiceClient().from('staff_temp_passwords').select('profile_id, temp_password, created_at'),
  ]);

  const roles = (rolesRes.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    pages: r.pages ?? [],
    isSystem: r.is_system,
  }));
  const tempPasswords: Record<string, { password: string; setAt: string }> = {};
  for (const t of tempRes.data ?? []) {
    tempPasswords[t.profile_id] = { password: t.temp_password, setAt: t.created_at };
  }

  // Clean up errant keys that were temporarily broadcasted to all staff
  const errantKeys = [
    'custom_role_8a9ae9ed-c242-40d2-92c6-50dd1fbd7942',
    'custom_role_59e4cf5c-0ba8-44d5-b095-3759318f1108',
    'custom_role_c500b4c3-9cc6-4b1c-9329-3b53ed407e1a',
    'custom_role_bd7e963e-bacd-46e0-bff9-8f35d281b750',
    'custom_role_ea7dca6f-f70c-4bbf-8054-5c92d1206128',
    'custom_role_aa99d539-3c8b-4dbc-b3c0-fe5d1923f529',
    'custom_role_7ac89818-9c5a-408c-845f-05c6bfb1a713',
    'custom_role_123dafd0-bffa-48de-8cee-1368781cc999',
    'custom_role_5107339a-bed7-4814-ab7e-c03ed367e80c',
    'custom_role_0ff58f98-2934-4357-b7a2-c812ee85dfc4',
  ];

  if (roleSettings?.some((s) => errantKeys.includes(s.key))) {
    try {
      await supabase.from('website_settings').delete().in('key', errantKeys);
    } catch {}
  }

  const customRoleMap = new Map<string, string>();
  if (roleSettings) {
    for (const s of roleSettings) {
      if (errantKeys.includes(s.key)) continue;
      const pId = s.key.replace('custom_role_', '');
      if (s.value && (s.value as any).role_title) {
        customRoleMap.set(pId, (s.value as any).role_title);
      }
    }
  }

  const deletedUserIds = new Set<string>();
  if (deletedSettings) {
    for (const s of deletedSettings) {
      deletedUserIds.add(s.key.replace('deleted_user_', ''));
    }
  }

  // Exclude soft-deleted users so they do not show in the tables, and attach custom role_title
  const users = (allUsers ?? [])
    .filter((u: any) => {
      if (u.is_deleted === true) return false;
      if (u.role_title === '[DELETED]') return false;
      if (deletedUserIds.has(u.id)) return false;
      return true;
    })
    .map((u: any) => ({
      ...u,
      role_title: u.role_title || customRoleMap.get(u.id) || null,
    }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-900">Users</h1>
          <p className="text-xs text-ink-500 mt-0.5">
            Create staff accounts, assign a role, and manage their passwords.
          </p>
        </div>
        <Link href="/travinco_dashboard/users/new" className="btn-primary">
          <Plus className="h-4 w-4" /> New user
        </Link>
      </div>

      <UsersTable
        initialUsers={users ?? []}
        currentUserId={profile.id}
        currentUserRole={profile.role}
        roles={roles}
        tempPasswords={tempRes.error ? null : tempPasswords}
      />
    </div>
  );
}
