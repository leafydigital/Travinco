import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { redirect, notFound } from 'next/navigation';
import { UserPermissionsForm } from './user-permissions-form';

export default async function EditUserPage({ params }: { params: { id: string } }) {
  const profile = await requireProfile();
  if (profile.role !== 'super_admin') {
    redirect('/admin?error=forbidden');
  }

  const supabase = await createClient();
  const [{ data: user }, { data: permissions }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', params.id).single(),
    supabase.from('staff_permissions').select('*').eq('profile_id', params.id),
  ]);

  if (!user) notFound();

  return (
    <div className="max-w-lg space-y-5">
      <h1 className="text-xl font-semibold text-ink-900">{user.full_name}</h1>
      <UserPermissionsForm
        userId={user.id}
        currentRole={user.role}
        isActive={user.is_active}
        isSelf={user.id === profile.id}
        existingPermissions={permissions ?? []}
      />
    </div>
  );
}
