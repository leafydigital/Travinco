import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { UserForm } from '../user-form';

export const metadata = { title: 'Edit user — Admin Portal' };

export default async function EditUserPage({ params }: { params: { id: string } }) {
  const profile = await requireProfile();
  if (profile.role !== 'admin' && profile.role !== 'super_admin') {
    redirect('/travinco_dashboard?error=unauthorized');
  }

  const supabase = await createClient();
  const [{ data: user }, { data: roleRows }, tempRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', params.id).single(),
    supabase.from('staff_roles').select('id, name, pages, is_system').order('is_system', { ascending: false }).order('name'),
    // The admin-set password (cleared automatically once the user changes it themselves)
    createServiceClient().from('staff_temp_passwords').select('temp_password').eq('profile_id', params.id).maybeSingle(),
  ]);

  if (!user) notFound();
  // Only the Super Admin can edit admins; nobody edits the Super Admin here
  if (user.role === 'super_admin' || (user.role === 'admin' && profile.role !== 'super_admin')) {
    redirect('/travinco_dashboard/users');
  }

  const roles = (roleRows ?? [])
    .filter((r) => !r.is_system || profile.role === 'super_admin' || r.id === user.role_id)
    .map((r) => ({ id: r.id, name: r.name, pages: r.pages ?? [], isSystem: r.is_system }));

  return (
    <div className="max-w-4xl space-y-4 pb-12">
      <div className="flex items-center gap-3">
        <Link
          href="/travinco_dashboard/users"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-600 shadow-2xs transition-colors hover:bg-ink-50 hover:text-ink-900"
          title="Back to Users"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-900">Edit user — {user.full_name}</h1>
          <p className="mt-0.5 text-xs text-ink-500">Change the name, username, phone, role or password. Page access follows the role.</p>
        </div>
      </div>
      <UserForm
        mode="edit"
        roles={roles}
        userId={user.id}
        isSelf={user.id === profile.id}
        initial={{
          full_name: user.full_name,
          email: user.email,
          username: user.username ?? null,
          phone: user.phone ?? null,
          role_id: user.role_id ?? null,
          password: tempRes.error ? null : tempRes.data?.temp_password ?? null,
        }}
      />
    </div>
  );
}
