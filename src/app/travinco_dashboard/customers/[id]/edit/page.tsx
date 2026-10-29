import { createClient } from '@/lib/supabase/server';
import { requireProfile, assertModulePermission } from '@/lib/supabase/auth-helpers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CustomerForm } from '../../customer-form';

export const metadata = { title: 'Edit customer — Admin Portal' };

export default async function EditCustomerPage({ params }: { params: { id: string } }) {
  const profile = await requireProfile();
  await assertModulePermission(profile, 'customers', 'edit');
  const supabase = await createClient();

  const [{ data: customer }, { data: delSetting }] = await Promise.all([
    supabase.from('customers').select('*').eq('id', params.id).maybeSingle(),
    supabase.from('website_settings').select('value').eq('key', `deleted_customer_${params.id}`).maybeSingle(),
  ]);

  if (!customer || (customer as any).is_deleted === true || delSetting) {
    notFound();
  }

  return (
    <div className="max-w-4xl space-y-5 pb-16">
      <div className="flex items-center gap-2">
        <Link
          href={`/travinco_dashboard/customers/${customer.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-brand-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to customer
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Edit Customer</h1>
          <p className="text-sm text-ink-500">{customer.full_name}</p>
        </div>
      </div>

      <CustomerForm
        customerId={customer.id}
        initialValues={{
          full_name: customer.full_name,
          phone: customer.phone,
          whatsapp_number: customer.whatsapp_number,
          email: customer.email,
          address: customer.address,
          city: customer.city,
          state: customer.state,
          country: customer.country ?? 'India',
          source: customer.source,
          tags: customer.tags,
          notes: customer.notes,
          whatsapp_opt_in: customer.whatsapp_opt_in,
        }}
      />
    </div>
  );
}
