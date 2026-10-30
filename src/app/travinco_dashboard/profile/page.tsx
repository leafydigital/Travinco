import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { ProfileView } from './profile-view';

export const metadata = { title: 'My profile — Admin Portal' };
export const dynamic = 'force-dynamic';

/** Every team member can see their own profile; admins can also edit it. */
export default async function ProfilePage() {
  const profile = await requireProfile();

  let roleName =
    profile.role === 'super_admin' ? 'Super Admin' : profile.role === 'admin' ? 'Admin' : profile.role_title || 'Staff';
  if (profile.role_id) {
    const supabase = await createClient();
    const { data: role } = await supabase.from('staff_roles').select('name').eq('id', profile.role_id).maybeSingle();
    if (role?.name && profile.role !== 'super_admin') roleName = role.name;
  }

  return (
    <div className="max-w-3xl space-y-4 pb-12">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink-900">My profile</h1>
        <p className="mt-0.5 text-xs text-ink-500">Your account details for the Travinco admin portal.</p>
      </div>
      <ProfileView
        canEdit={profile.role === 'admin' || profile.role === 'super_admin'}
        profile={{
          full_name: profile.full_name,
          username: profile.username ?? null,
          email: profile.email,
          phone: profile.phone ?? null,
          address: profile.address ?? null,
          roleName,
        }}
      />
    </div>
  );
}
