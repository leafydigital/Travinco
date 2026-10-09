import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { assertTourAccess, canOverrideMarkup } from '@/lib/tour/access';
import { loadRatesForStays, loadTourMasters } from '@/lib/tour/data';
import { normalizeInputs } from '@/lib/tour/engine';
import { QuotationBuilder } from '@/components/tour/quotation-builder';
import type { QuoteInputs } from '@/lib/tour/types';

export const metadata: Metadata = { title: 'Edit quotation — Admin Portal' };

export default async function EditQuotationPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const [profile, { data: q }, m] = await Promise.all([
    requireProfile(),
    supabase.from('quotations').select('id, quote_number, status, inputs').eq('id', params.id).maybeSingle(),
    loadTourMasters(),
  ]);
  assertTourAccess(profile, 'quotations');
  if (!q) notFound();
  if (q.status === 'invoiced') redirect(`/admin/quotations/${q.id}?locked=1`);
  const inputs = normalizeInputs(q.inputs as Partial<QuoteInputs>, m);
  const rates = await loadRatesForStays(m, inputs.stays.map((s) => s.location_id));

  return (
    <QuotationBuilder
      masters={m}
      initial={inputs}
      initialRates={rates}
      quoteId={q.id}
      quoteNumber={q.quote_number}
      canOverrideMarkup={canOverrideMarkup(profile)}
    />
  );
}
