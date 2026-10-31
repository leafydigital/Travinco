'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/admin-alert';
import { InvoiceForm, type InvoiceFormFields, type InvoiceFormItem, type InvoiceFormPayload } from '@/components/tour/invoice-form';
import { createInvoice } from '../actions';

export function NewInvoiceClient({
  initialFields,
  initialItems,
  companyState,
  dueDays,
  enquiryId,
  customerId,
  cancelHref,
}: {
  initialFields: InvoiceFormFields;
  initialItems: InvoiceFormItem[];
  companyState: string;
  dueDays?: number;
  enquiryId: string | null;
  customerId: string | null;
  cancelHref: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const save = (payload: InvoiceFormPayload) =>
    start(async () => {
      const r = await createInvoice({ ...payload, enquiry_id: enquiryId, customer_id: customerId });
      if (r.error) return void toast.error(r.error);
      toast.success('Invoice created');
      if (r.id) router.push(`/travinco_dashboard/invoices/${r.id}`);
    });

  return (
    <div className="card p-5">
      <InvoiceForm
        initialFields={initialFields}
        initialItems={initialItems}
        companyState={companyState}
        dueDays={dueDays}
        submitLabel="Create invoice"
        pendingLabel="Creating…"
        pending={pending}
        onSubmit={save}
        onCancel={() => router.push(cancelHref)}
      />
    </div>
  );
}
