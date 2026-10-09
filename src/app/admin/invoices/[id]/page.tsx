import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { assertTourAccess, isAdminRole, isFinanceRole } from '@/lib/tour/access';
import { getTourSettings } from '@/lib/tour/data';
import { InvoiceDocument, type InvoiceDoc } from '@/components/tour/invoice-document';
import { InvoiceStatusBadge } from '@/components/tour/status-badges';
import { waLink } from '@/lib/tour/wa';
import { InvoiceToolbar, PaymentsPanel } from './invoice-client';

export const metadata: Metadata = { title: 'Invoice — Admin Portal' };

export default async function InvoicePage({ params }: { params: { id: string } }) {
  const profile = await requireProfile();
  assertTourAccess(profile, 'invoices');
  const supabase = await createClient();
  const [{ data: inv }, { data: payments }, settings] = await Promise.all([
    supabase.from('invoices').select('*, quotations(id, quote_number)').eq('id', params.id).maybeSingle(),
    supabase.from('invoice_payments').select('*').eq('invoice_id', params.id).order('paid_on'),
    getTourSettings(),
  ]);
  if (!inv) notFound();
  const q = (Array.isArray(inv.quotations) ? inv.quotations[0] : inv.quotations) as { id: string; quote_number: string } | null;
  const doc: InvoiceDoc = {
    ...inv,
    items: Array.isArray(inv.items) ? inv.items : [],
    quote_number: q?.quote_number ?? null,
  };
  const fileName = `${inv.invoice_number}_${inv.bill_to_name}`.replace(/[^\w\-]+/g, '_');
  const balance = inv.status === 'cancelled' ? 0 : Number(inv.balance_amount);
  const msg = `Dear ${inv.bill_to_name},\nPlease find invoice ${inv.invoice_number} for ₹${Number(inv.total_amount).toLocaleString('en-IN')}${balance > 0 ? ` (balance due ₹${balance.toLocaleString('en-IN')})` : ''}.\n${settings.bank_details ? `\nPayment details:\n${settings.bank_details}\n` : ''}\nThank you – ${settings.company_name ?? 'Travinco'}`;

  return (
    <div className="space-y-5 pb-16 print:space-y-0 print:pb-0">
      <div className="space-y-3 print:hidden">
        <Link href="/admin/invoices" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Invoices
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-ink-900">{inv.invoice_number}</h1>
              <InvoiceStatusBadge status={inv.status} />
            </div>
            <p className="text-sm text-ink-500">
              {inv.bill_to_name}
              {q && (
                <>
                  {' · from '}
                  <Link className="text-brand-700 hover:underline" href={`/admin/quotations/${q.id}`}>{q.quote_number}</Link>
                </>
              )}
              {inv.customer_id && (
                <>
                  {' · '}
                  <Link className="text-brand-700 hover:underline" href={`/admin/customers/${inv.customer_id}`}>customer</Link>
                </>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums text-ink-900">₹{Number(inv.total_amount).toLocaleString('en-IN')}</p>
            <p className="text-sm text-ink-500">Paid ₹{Number(inv.amount_paid).toLocaleString('en-IN')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InvoiceToolbar id={inv.id} inv={doc} fileName={fileName} canCancel={isFinanceRole(profile)} companyState={settings.company_state || 'Kerala'} />
          {inv.bill_to_phone && (
            <a className="btn-outline" href={waLink(inv.bill_to_phone, msg)} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          )}
        </div>
        {!settings.company_gstin && (
          <p className="rounded-lg bg-sand-50 px-3 py-2 text-sm text-sand-900">
            Add your GSTIN, address and bank details under <Link href="/admin/quotations/settings" className="underline">Quotations › Settings</Link> so they print on invoices.
          </p>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] print:block">
        <div className="card overflow-hidden print:border-0 print:shadow-none">
          <InvoiceDocument inv={doc} s={settings} />
        </div>
        <PaymentsPanel
          id={inv.id}
          payments={payments ?? []}
          balance={balance}
          totalAmount={Number(inv.total_amount)}
          amountPaid={Number(inv.amount_paid)}
          cancelled={inv.status === 'cancelled'}
          isAdmin={isAdminRole(profile)}
        />
      </div>
    </div>
  );
}
