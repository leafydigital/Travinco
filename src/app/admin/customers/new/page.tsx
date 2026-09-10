import { requireProfile } from '@/lib/supabase/auth-helpers';
import { CustomerForm } from '../customer-form';

export const metadata = { title: 'New customer' };

export default async function NewCustomerPage() {
  await requireProfile();
  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-xl font-semibold text-ink-900">New customer</h1>
      <CustomerForm />
    </div>
  );
}
