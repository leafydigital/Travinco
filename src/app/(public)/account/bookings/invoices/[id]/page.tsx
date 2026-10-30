import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireCustomer } from '@/lib/supabase/customer-auth-helpers';
import { getCustomerInvoiceById } from '@/lib/services/customer-account';
import { getTourSettings } from '@/lib/tour/data';
import { createCustomerClient } from '@/lib/supabase/server';
import { InvoiceDocument } from '@/components/tour/invoice-document';
import { CustomerDocToolbar } from '../../doc-toolbar';

export const metadata: Metadata = {
  title: 'My Tax Invoice — Travinco',
};

export default async function CustomerInvoicePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { download?: string };
}) {
  const account = await requireCustomer('/account/bookings');
  const invoiceData = await getCustomerInvoiceById(params.id, account.email);

  if (!invoiceData) {
    notFound();
  }

  const { invoice, rawInvoice } = invoiceData;
  const supabase = await createCustomerClient();
  const settings = await getTourSettings(supabase);

  const fileName = `${invoice.invoice_number}_${rawInvoice.bill_to_name || 'Invoice'}`.replace(/[^\w\-]+/g, '_');

  return (
    <div className="min-h-screen bg-sand-50/50 pt-28 pb-16 print:bg-white print:p-0">
      <div className="container-page mx-auto max-w-5xl px-4 sm:px-6">
        <CustomerDocToolbar
          title={`Tax Invoice ${invoice.invoice_number}`}
          docType="invoice"
          docNumber={invoice.invoice_number}
          elementId="invoice-doc"
          fileName={fileName}
          autoDownload={searchParams.download === '1'}
        />

        <div className="rounded-xl border border-ink-200/80 bg-white p-4 shadow-sm sm:p-8 print:border-none print:p-0 print:shadow-none">
          <InvoiceDocument inv={invoice} s={settings} />
        </div>
      </div>
    </div>
  );
}
