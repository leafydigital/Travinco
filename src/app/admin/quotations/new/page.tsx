import type { Metadata } from 'next';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { assertTourAccess, canOverrideMarkup } from '@/lib/tour/access';
import { loadRatesForStays, loadTourMasters } from '@/lib/tour/data';
import { blankInputs, inputsFromTemplate } from '@/lib/tour/engine';
import { QuotationBuilder } from '@/components/tour/quotation-builder';

export const metadata: Metadata = { title: 'New quotation — Admin Portal' };

function QuotationBuilderSkeleton() {
  return (
    <div className="space-y-5 pb-24 animate-pulse">
      {/* Real page title shell */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">New quotation</h1>
          <p className="text-sm text-ink-500">Pick a package template or add stays to begin.</p>
        </div>
      </div>

      {/* Top Form Unified Card Skeleton */}
      <div className="card p-5 space-y-5">
        <div className="h-9 rounded-lg bg-ink-50" />
        <div className="space-y-3">
          <div className="h-4 w-44 rounded bg-ink-200/70" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-16 rounded bg-ink-100" />
                <div className="h-8 rounded-lg bg-ink-100" />
              </div>
            ))}
          </div>
        </div>
        <hr className="border-ink-100" />
        <div className="space-y-2">
          <div className="h-4 w-36 rounded bg-ink-200/70" />
          <div className="h-16 rounded-lg bg-ink-50" />
        </div>
      </div>

      {/* Bottom Live Preview Skeleton */}
      <div className="space-y-3 pt-2">
        <div className="h-5 w-44 rounded bg-ink-200/70" />
        <div className="card p-6 space-y-4">
          <div className="h-10 w-48 mx-auto rounded bg-ink-100" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-ink-100" />
            <div className="h-4 w-5/6 rounded bg-ink-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

async function NewQuotationLoader({
  searchParams,
}: {
  searchParams: { enquiry?: string; customer?: string; template?: string };
}) {
  const [profile, m] = await Promise.all([
    requireProfile(),
    loadTourMasters(),
  ]);
  assertTourAccess(profile, 'quotations');
  const supabase = await createClient();
  let inputs = blankInputs(m);

  const tpl = searchParams.template ? m.templates.find((t) => String(t.id) === searchParams.template) : undefined;
  if (tpl) inputs = inputsFromTemplate(m, inputs, tpl);

  if (searchParams.enquiry) {
    const { data: e } = await supabase
      .from('enquiries')
      .select('id, customer_id, customer_name, phone, email, travel_date, number_of_adults, number_of_children')
      .eq('id', searchParams.enquiry)
      .maybeSingle();
    if (e) {
      inputs = {
        ...inputs,
        enquiry_id: e.id,
        customer_id: e.customer_id,
        guest_name: e.customer_name ?? '',
        guest_phone: e.phone ?? '',
        guest_email: e.email ?? '',
        adults: Math.max(1, e.number_of_adults ?? 2),
        rooms: Math.max(1, Math.ceil((e.number_of_adults ?? 2) / 2)),
        cwb: e.number_of_children ?? 0,
        start_date: e.travel_date && e.travel_date >= new Date().toISOString().slice(0, 10) ? e.travel_date : inputs.start_date,
      };
    }
  } else if (searchParams.customer) {
    const { data: c } = await supabase.from('customers').select('id, full_name, phone, email').eq('id', searchParams.customer).maybeSingle();
    if (c) inputs = { ...inputs, customer_id: c.id, guest_name: c.full_name, guest_phone: c.phone ?? '', guest_email: c.email ?? '' };
  }

  const rates = inputs.stays.length ? await loadRatesForStays(m, inputs.stays.map((s) => s.location_id)) : [];

  return (
    <QuotationBuilder
      masters={m}
      initial={inputs}
      initialRates={rates}
      quoteId={null}
      canOverrideMarkup={canOverrideMarkup(profile)}
    />
  );
}

export default function NewQuotationPage({
  searchParams,
}: {
  searchParams: { enquiry?: string; customer?: string; template?: string };
}) {
  return (
    <Suspense fallback={<QuotationBuilderSkeleton />}>
      <NewQuotationLoader searchParams={searchParams} />
    </Suspense>
  );
}
