import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireProfile, assertModulePermission } from '@/lib/supabase/auth-helpers';
import { CustomerForm } from '../customer-form';

export const metadata = { title: 'New customer' };

export default async function NewCustomerPage() {
  const profile = await requireProfile();
  await assertModulePermission(profile, 'customers', 'edit');
  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/travinco_dashboard/customers"
          className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-ink-700 shadow-2xs hover:bg-ink-50 hover:text-ink-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to customers</span>
        </Link>
        <h1 className="text-xl font-semibold text-ink-900">New customer</h1>
      </div>
      <CustomerForm />
    </div>
  );
}
