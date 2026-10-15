import { requireProfile, assertModulePermission } from '@/lib/supabase/auth-helpers';
import { CustomerForm } from '../customer-form';

export const metadata = { title: 'New customer' };

export default async function NewCustomerPage() {
  const profile = await requireProfile();
  await assertModulePermission(profile, 'customers', 'edit');
  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-xl font-semibold text-ink-900">New customer</h1>
      <CustomerForm />
    </div>
  );
}
