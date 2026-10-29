import { requireProfile } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { UserForm } from '../user-form';

export const metadata = { title: 'New user — Admin Portal' };

export default async function NewUserPage() {
  const profile = await requireProfile();
  if (profile.role !== 'admin' && profile.role !== 'super_admin') {
    redirect('/travinco_dashboard?error=unauthorized');
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('staff_roles')
    .select('id, name, pages, is_system')
    .order('is_system', { ascending: false })
    .order('name');
  const roles = (data ?? [])
    // Only the Super Admin can create other admins
    .filter((r) => !r.is_system || profile.role === 'super_admin')
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
          <h1 className="text-xl font-bold tracking-tight text-ink-900">New user</h1>
          <p className="mt-0.5 text-xs text-ink-500">Create a staff account, choose their role and set a temporary password.</p>
        </div>
      </div>
      <UserForm mode="create" roles={roles} />
    </div>
  );
}
