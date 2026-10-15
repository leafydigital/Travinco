import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { redirect, notFound } from 'next/navigation';
import { UserPermissionsForm } from './user-permissions-form';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function EditUserPage({ params }: { params: { id: string } }) {
  const profile = await requireProfile();
  if (profile.role !== 'admin' && profile.role !== 'super_admin') {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/travinco_admin_login?reason=forbidden');
  }

  const supabase = await createClient();
  const [{ data: user }, { data: permissions }, { data: customRoleSetting }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', params.id).single(),
    supabase.from('staff_permissions').select('*').eq('profile_id', params.id),
    supabase.from('website_settings').select('value').eq('key', `custom_role_${params.id}`).maybeSingle(),
  ]);

  if (!user) notFound();

  const customRole = user.role_title || (customRoleSetting?.value as any)?.role_title || null;

  return (
    <div className="max-w-5xl space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Link
          href="/travinco_dashboard/users"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-600 hover:bg-ink-50 hover:text-ink-900 transition-colors shadow-2xs"
          title="Back to Users"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">
            Edit Staff Member — {user.full_name}
          </h1>
          <p className="text-xs text-ink-500 mt-0.5">
            Update role designation, active status, and granular page access permissions.
          </p>
        </div>
      </div>

      <UserPermissionsForm
        userId={user.id}
        userName={user.full_name}
        userEmail={user.email}
        currentRole={customRole || (user.role === 'admin' ? 'Admin' : 'Staff')}
        isActive={user.is_active}
        isSelf={user.id === profile.id}
        existingPermissions={permissions ?? []}
      />
    </div>
  );
}
