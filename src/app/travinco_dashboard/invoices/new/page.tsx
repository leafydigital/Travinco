import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireProfile, assertPageAccess } from '@/lib/supabase/auth-helpers';
import { assertTourAccess, isAdminRole } from '@/lib/tour/access';
import { getTourSettings } from '@/lib/tour/data';
import type { InvoiceFormFields, InvoiceFormItem } from '@/components/tour/invoice-form';
import { NewInvoiceClient } from './new-invoice-client';

export const metadata: Metadata = { title: 'New invoice — Admin Portal' };

type PackageRel = { title: string; base_price: number | null; discount_price: number | null };

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: { enquiry?: string; customer?: string };
}) {
  const profile = await requireProfile();
  await assertPageAccess(profile, 'invoices');
  assertTourAccess(profile, 'invoices');
  const supabase = await createClient();
  const settings = await getTourSettings();

  const companyState = settings.company_state || 'Kerala';
  const fields: InvoiceFormFields = {
    bill_to_name: '',
    bill_to_phone: '',
    bill_to_email: '',
    bill_to_address: '',
    bill_to_gstin: '',
    place_of_supply: companyState,
    invoice_date: '',
    due_date: '',
    travel_start: '',
    travel_end: '',
    discount: '0',
    gst_pct: String(settings.gst_pct),
    tax_mode: 'cgst_sgst',
    notes: '',
    terms: settings.invoice_terms ?? '',
    markup_pct: String(settings.markup_pct ?? 15),
    markup_amount: '',
  };
  const item: InvoiceFormItem = { description: '', sac: settings.sac_code || '998555', qty: '1', rate: '0' };

  let enquiryId: string | null = null;
  let customerId: string | null = null;
  let backHref = '/travinco_dashboard/invoices';
  let source: string | null = null;

  if (searchParams.enquiry) {
    const { data: e } = await supabase
      .from('enquiries')
      .select('id, enquiry_number, customer_id, customer_name, phone, email, travel_date, return_date, destination, number_of_adults, number_of_children, assigned_staff, is_deleted, travel_packages(title, base_price, discount_price)')
      .eq('id', searchParams.enquiry)
      .maybeSingle();
    if (e && !e.is_deleted && (isAdminRole(profile) || e.assigned_staff === profile.id)) {
      enquiryId = e.id;
      customerId = e.customer_id ?? null;
      backHref = `/travinco_dashboard/enquiries/${e.id}`;
      source = `enquiry ${e.enquiry_number}`;
      fields.bill_to_name = e.customer_name ?? '';
      fields.bill_to_phone = e.phone ?? '';
      fields.bill_to_email = e.email ?? '';
      fields.travel_start = e.travel_date ?? '';
      fields.travel_end = e.return_date ?? '';

      const pkgRaw = e.travel_packages as PackageRel | PackageRel[] | null;
      const pkg = Array.isArray(pkgRaw) ? pkgRaw[0] ?? null : pkgRaw;
      const pax = Math.max(1, (e.number_of_adults ?? 0) + (e.number_of_children ?? 0));
      const title = pkg?.title ?? e.destination ?? 'Tour package';
      const unit = pkg?.discount_price ?? pkg?.base_price ?? 0;
      item.description = `${title}${e.travel_date ? ` – travel ${e.travel_date}${e.return_date ? ` to ${e.return_date}` : ''}` : ''}; ${pax} guest${pax > 1 ? 's' : ''}. Ref ${e.enquiry_number}.`;
      item.rate = String(unit * pax);
    }
  } else if (searchParams.customer) {
    const { data: c } = await supabase
      .from('customers')
      .select('id, full_name, phone, email')
      .eq('id', searchParams.customer)
      .maybeSingle();
    if (c) {
      customerId = c.id;
      backHref = `/travinco_dashboard/customers/${c.id}`;
      source = `customer ${c.full_name}`;
      fields.bill_to_name = c.full_name;
      fields.bill_to_phone = c.phone ?? '';
      fields.bill_to_email = c.email ?? '';
    }
  }

  return (
    <div className="space-y-5 pb-16">
      <div className="space-y-3">
        <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-ink-900">New invoice</h1>
          <p className="text-sm text-ink-500">
            {source ? `Prefilled from ${source}. ` : ''}Enter the bill-to details and line items; GST is worked out for you.
          </p>
        </div>
      </div>
      <NewInvoiceClient
        initialFields={fields}
        initialItems={[item]}
        companyState={companyState}
        dueDays={settings.invoice_due_days || undefined}
        enquiryId={enquiryId}
        customerId={customerId}
        cancelHref={backHref}
      />
    </div>
  );
}
