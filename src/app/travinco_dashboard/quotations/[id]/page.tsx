import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { assertTourAccess, isAdminRole } from '@/lib/tour/access';
import { whatsappText, inr } from '@/lib/tour/engine';
import { formatDate, formatDateTime } from '@/lib/utils/format';
import { QuoteDocument } from '@/components/tour/quote-document';
import { QuoteStatusBadge } from '@/components/tour/status-badges';
import type { QuoteSnapshot } from '@/lib/tour/types';
import { QuoteActions } from './quote-actions';

export const metadata: Metadata = { title: 'Quotation — Admin Portal' };

export default async function QuotationPage({ params, searchParams }: { params: { id: string }; searchParams: { locked?: string } }) {
  const profile = await requireProfile();
  assertTourAccess(profile, 'quotations');
  const supabase = await createClient();
  const [{ data: q }, { data: inv }] = await Promise.all([
    supabase.from('quotations').select('*, profiles:created_by(full_name)').eq('id', params.id).maybeSingle(),
    supabase.from('invoices').select('id, invoice_number, status').eq('quotation_id', params.id).neq('status', 'cancelled').maybeSingle(),
  ]);
  if (!q) notFound();
  const snap = q.snapshot as QuoteSnapshot;
  const by = (Array.isArray(q.profiles) ? q.profiles[0] : q.profiles) as { full_name: string } | null;
  const fileName = `${q.quote_number} ${q.guest_name} ${snap.duration}`.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_');
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5 pb-16 print:space-y-0 print:pb-0">
      <div className="space-y-3 print:hidden">
        <Link href="/admin/quotations" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Quotations
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-ink-900">{q.quote_number}</h1>
              <QuoteStatusBadge status={q.status} />
            </div>
            <p className="text-sm text-ink-500">
              {q.guest_name}
              {q.guest_phone ? ` · ${q.guest_phone}` : ''} · {formatDate(q.start_date)} · {q.nights + 1}D/{q.nights}N
            </p>
            <p className="text-xs text-ink-400">
              Created {formatDateTime(q.created_at)}{by?.full_name ? ` by ${by.full_name}` : ''} · valid until {formatDate(q.valid_until)}
              {q.valid_until && q.valid_until < today && q.status !== 'invoiced' ? ' (passed)' : ''}
              {q.enquiry_id && (
                <>
                  {' · '}
                  <Link className="text-brand-700 hover:underline" href={`/admin/enquiries/${q.enquiry_id}`}>enquiry</Link>
                </>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums text-ink-900">₹{inr(Number(q.total_amount))}</p>
            {q.total_amount2 != null && <p className="text-sm text-ink-500">Option 2: ₹{inr(Number(q.total_amount2))}</p>}
          </div>
        </div>

        <QuoteActions
          id={q.id}
          number={q.quote_number}
          status={q.status}
          phone={q.guest_phone}
          whatsapp={whatsappText(snap)}
          options={snap.options.map((o) => ({ label: o.label, total: o.total }))}
          invoiceId={inv?.id ?? null}
          isAdmin={isAdminRole(profile)}
          fileName={fileName}
        />

        {searchParams.locked && (
          <p className="flex items-center gap-2 rounded-lg bg-sand-50 px-3 py-2 text-sm text-sand-900">
            <Lock className="h-4 w-4" /> This quotation is invoiced, so it can no longer be edited. Duplicate it to make a new version.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Hotels', q.hotel_cost],
            ['Vehicle', q.vehicle_cost],
            ['Net cost', q.net_cost],
            [`Markup ${Number(q.markup_pct)}% · GST ${Number(q.gst_pct)}%`, Number(q.markup_amount) + Number(q.gst_amount)],
          ].map(([k, v]) => (
            <div key={String(k)} className="card p-3">
              <p className="text-xs text-ink-400">{k}</p>
              <p className="font-semibold tabular-nums text-ink-800">₹{inr(Number(v))}</p>
            </div>
          ))}
        </div>

        {snap.warnings?.length > 0 && (
          <details className="card border-sand-300 bg-sand-50 p-4 text-sm text-sand-900">
            <summary className="flex cursor-pointer items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-4 w-4" /> {snap.warnings.length} pricing note{snap.warnings.length > 1 ? 's' : ''} when this was saved
            </summary>
            <ul className="mt-2 space-y-1 text-xs">
              {snap.warnings.map((w) => <li key={w}>• {w}</li>)}
            </ul>
          </details>
        )}
        {q.notes && <p className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-600"><b>Internal note:</b> {q.notes}</p>}
      </div>

      <div className="card overflow-hidden print:border-0 print:shadow-none">
        <QuoteDocument s={snap} quoteNumber={q.quote_number} />
      </div>
    </div>
  );
}
