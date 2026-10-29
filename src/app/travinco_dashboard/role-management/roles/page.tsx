import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { RolesClient, type RoleRow } from './roles-client';

export const metadata: Metadata = { title: 'Roles — Admin Portal' };
export const dynamic = 'force-dynamic';

export default async function RolesPage() {
  const profile = await requireProfile();
  if (profile.role !== 'admin' && profile.role !== 'super_admin') {
    redirect('/travinco_dashboard?error=unauthorized');
  }

  const supabase = await createClient();
  const [rolesRes, { data: assigned }] = await Promise.all([
    supabase.from('staff_roles').select('*').order('is_system', { ascending: false }).order('name'),
    supabase.from('profiles').select('role_id, is_deleted').not('role_id', 'is', null),
  ]);

  const userCounts = new Map<string, number>();
  for (const p of (assigned ?? []) as { role_id: string | null; is_deleted?: boolean }[]) {
    if (!p.role_id || p.is_deleted) continue;
    userCounts.set(p.role_id, (userCounts.get(p.role_id) ?? 0) + 1);
  }

  const roles: RoleRow[] = (rolesRes.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    pages: r.pages ?? [],
    isSystem: r.is_system,
    userCount: userCounts.get(r.id) ?? 0,
    updatedAt: r.updated_at,
  }));

  return <RolesClient roles={roles} />;
}
