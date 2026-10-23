import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireCustomer } from '@/lib/supabase/customer-auth-helpers';
import { getCustomerQuotationById } from '@/lib/services/customer-account';
import { getTourSettings } from '@/lib/tour/data';
import { createCustomerClient } from '@/lib/supabase/server';
import { QuoteDocument } from '@/components/tour/quote-document';
import { CustomerDocToolbar } from '../../doc-toolbar';
import type { QuoteSnapshot } from '@/lib/tour/types';

export const metadata: Metadata = {
  title: 'My Tour Quotation — Travinco',
};

export default async function CustomerQuotationPage({
  params,
}: {
  params: { id: string };
}) {
  const account = await requireCustomer('/account/bookings');
  const quoteData = await getCustomerQuotationById(params.id, account.email);

  if (!quoteData) {
    notFound();
  }

  const { quotation } = quoteData;
  const snapshot = quotation.snapshot as QuoteSnapshot;
  const supabase = await createCustomerClient();
  const settings = await getTourSettings(supabase);

  const cleanTitle = quotation.title || snapshot.doc_title || 'Kerala Tour Itinerary';
  const fileName = `${quotation.quote_number}_${cleanTitle}`.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_');

  return (
    <div className="min-h-screen bg-sand-50/50 pt-28 pb-16 print:bg-white print:p-0">
      <div className="container-page mx-auto max-w-5xl px-4 sm:px-6">
        <CustomerDocToolbar
          title={cleanTitle}
          docType="quotation"
          docNumber={quotation.quote_number}
          elementId="quote-doc"
          fileName={fileName}
        />

        <div className="rounded-xl border border-ink-200/80 bg-white p-4 shadow-sm sm:p-8 print:border-none print:p-0 print:shadow-none">
          <QuoteDocument
            s={snapshot}
            quoteNumber={quotation.quote_number}
            logosConfig={settings.logos_config}
          />
        </div>
      </div>
    </div>
  );
}
