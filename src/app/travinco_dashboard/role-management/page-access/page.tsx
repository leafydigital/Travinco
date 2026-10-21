import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { PageAccessClient } from './page-access-client';

export const metadata: Metadata = {
  title: 'Page Access Management — Admin Portal',
};

export default async function PageAccessManagementPage() {
  const profile = await requireProfile();

  // Strict Server Guard: Only admins & super_admin can enter Role Management
  if (profile.role !== 'admin' && profile.role !== 'super_admin') {
    redirect('/travinco_dashboard?error=unauthorized');
  }

  const supabase = await createClient();

  // Fetch all staff members (excluding super_admin whose master privileges cannot be restricted)
  const [{ data: staffUsers }, { data: allPermissions }, { data: allSettings }, { data: roleSettings }, { data: deletedSettings }] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .neq('role', 'super_admin')
      .order('full_name', { ascending: true }),
    supabase
      .from('staff_permissions')
      .select('*'),
    supabase
      .from('website_settings')
      .select('key, value')
      .like('key', 'staff_perms_%'),
    supabase
      .from('website_settings')
      .select('key, value')
      .like('key', 'custom_role_%'),
    supabase
      .from('website_settings')
      .select('key')
      .like('key', 'deleted_user_%'),
  ]);

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

  const activeStaff = (staffUsers ?? [])
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

  // Merge full page permissions list from website_settings if present
  const mergedPermissions = [...(allPermissions ?? [])];
  if (allSettings && allSettings.length > 0) {
    for (const s of allSettings) {
      const profileId = s.key.replace('staff_perms_', '');
      if (s.value && Array.isArray((s.value as any).pages)) {
        // Filter out any partial enum records for this profile so the complete list is used
        const remaining = mergedPermissions.filter((p) => p.profile_id !== profileId);
        mergedPermissions.length = 0;
        mergedPermissions.push(...remaining);

        const pages = (s.value as any).pages as string[];
        for (const pageKey of pages) {
          mergedPermissions.push({
            id: `setting_${profileId}_${pageKey}`,
            profile_id: profileId,
            module: pageKey as any,
            can_view: true,
            can_edit: true,
            created_at: new Date().toISOString(),
          });
        }
      }
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">
          Page Access Management
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Control which pages each staff member can view and access. When permissions are configured, only granted pages will appear in their sidebar navigation.
        </p>
      </div>

      <PageAccessClient
        staffList={activeStaff}
        initialPermissions={mergedPermissions}
        currentAdminRole={profile.role}
      />
    </div>
  );
}
