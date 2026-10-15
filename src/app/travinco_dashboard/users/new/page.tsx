import { requireProfile } from '@/lib/supabase/auth-helpers';
import { redirect } from 'next/navigation';
import { UserForm } from '../user-form';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function NewUserPage() {
  const profile = await requireProfile();
  if (profile.role !== 'admin' && profile.role !== 'super_admin') {
    redirect('/travinco_admin_login?reason=forbidden');
  }

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
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">Add New Staff User</h1>
          <p className="text-xs text-ink-500 mt-0.5">
            Create a staff account and configure their accessible pages & modules in one step.
          </p>
        </div>
      </div>
      <UserForm />
    </div>
  );
}
