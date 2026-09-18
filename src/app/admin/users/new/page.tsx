import { requireProfile } from '@/lib/supabase/auth-helpers';
import { redirect } from 'next/navigation';
import { UserForm } from '../user-form';

export default async function NewUserPage() {
  const profile = await requireProfile();
  if (profile.role !== 'super_admin') {
    redirect('/admin?error=forbidden');
  }

  return (
    <div className="max-w-lg space-y-5">
      <h1 className="text-xl font-semibold text-ink-900">New user</h1>
      <UserForm />
    </div>
  );
}
