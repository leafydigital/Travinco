import { FilterBar } from '@/components/admin/filter-bar';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { requireProfile, assertPageAccess } from '@/lib/supabase/auth-helpers';
import { assertTourAccess, isAdminRole } from '@/lib/tour/access';
import { formatDate } from '@/lib/utils/format';
import { InvoiceStatusBadge } from '@/components/tour/status-badges';
import { InvoiceRowActions } from './invoice-row-actions';
import { getInvoicesTableList } from './actions';

export const metadata: Metadata = { title: 'Invoices — Admin Portal' };

const PAGE_SIZE = 20;
const STATUSES = ['Issued', 'Partially Paid', 'Paid', 'Cancelled'];
const rs = (n: unknown) => `₹${Math.round(Number(n)).toLocaleString('en-IN')}`;

function InvoicesTableSkeleton() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <th className="px-5 py-3">Invoice</th>
            <th className="px-5 py-3">Quote #</th>
            <th className="px-5 py-3">Bill to</th>
            <th className="px-5 py-3">Date</th>
            <th className="px-5 py-3 text-right">Total</th>
            <th className="px-5 py-3 text-right">Paid</th>
            <th className="px-5 py-3 text-right">Balance</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-50">
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i} className="animate-pulse">
              <td className="px-5 py-3.5"><div className="h-4 w-28 rounded bg-ink-200/70" /></td>
              <td className="px-5 py-3.5"><div className="h-4 w-24 rounded bg-ink-100" /></td>
              <td className="px-5 py-3.5">
                <div className="h-4 w-32 rounded bg-ink-200/70 mb-1.5" />
                <div className="h-3 w-24 rounded bg-ink-100" />
              </td>
              <td className="px-5 py-3.5"><div className="h-4 w-20 rounded bg-ink-100" /></td>
              <td className="px-5 py-3.5 text-right"><div className="h-4 w-16 rounded bg-ink-200/70 ml-auto" /></td>
              <td className="px-5 py-3.5 text-right"><div className="h-4 w-16 rounded bg-ink-100 ml-auto" /></td>
              <td className="px-5 py-3.5 text-right"><div className="h-4 w-16 rounded bg-ink-100 ml-auto" /></td>
              <td className="px-5 py-3.5"><div className="h-6 w-16 rounded-full bg-ink-100" /></td>
              <td className="px-5 py-3.5 text-right"><div className="h-8 w-16 rounded bg-ink-100 ml-auto" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function InvoicesTableContent({
  searchParams,
  isAdmin,
}: {
  searchParams: { q?: string; status?: string; page?: string };
  isAdmin: boolean;
}) {
  const page = Math.max(1, Number(searchParams.page ?? 1));

  const {
    invoices: visibleRows,
    totalCount,
    totalPages,
  } = await getInvoicesTableList({
    page,
    pageSize: PAGE_SIZE,
    q: searchParams.q,
    status: searchParams.status,
  });

  const today = new Date().toISOString().slice(0, 10);

  const href = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    Object.entries({ ...searchParams, ...o }).forEach(([k, v]) => v && p.set(k, v));
    return `?${p.toString()}`;
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="px-5 py-3">Invoice</th>
              <th className="px-5 py-3">Quote #</th>
              <th className="px-5 py-3">Bill to</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3 text-right">Total</th>
              <th className="px-5 py-3 text-right">Paid</th>
              <th className="px-5 py-3 text-right">Balance</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-ink-400">
                  No invoices yet.
                </td>
              </tr>
            )}
            {visibleRows.map((r) => {
              const overdue = r.status === 'issued' && r.due_date && r.due_date < today;
              return (
                <tr key={r.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/travinco_dashboard/invoices/${r.id}`}
                      prefetch={true}
                      className="font-medium text-ink-800 hover:text-brand-700"
                    >
                      {r.invoice_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-ink-500">{r.quote_number || '—'}</td>
                  <td className="px-5 py-3">
                    <p className="text-ink-700">{r.bill_to_name}</p>
                    {r.bill_to_phone && <p className="text-xs text-ink-400">{r.bill_to_phone}</p>}
                  </td>
                  <td className="px-5 py-3 text-ink-500">
                    {formatDate(r.invoice_date)}
                    {overdue && <p className="text-xs text-coral-700">Overdue (due {formatDate(r.due_date)})</p>}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-ink-800">{rs(r.total_amount)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-brand-700">{rs(r.amount_paid)}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium text-coral-700">{rs(r.balance_amount)}</td>
                  <td className="px-5 py-3">
                    <InvoiceStatusBadge status={r.status} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <InvoiceRowActions
                      id={r.id}
                      invoiceNumber={r.invoice_number}
                      isAdmin={isAdmin}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3 text-sm text-ink-500">
          <span>Page {page} of {totalPages} ({totalCount} total)</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={href({ page: String(page - 1) })} className="btn-outline px-3 py-1.5">
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={href({ page: String(page + 1) })} className="btn-outline px-3 py-1.5">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string };
}) {
  const profile = await requireProfile();
  await assertPageAccess(profile, 'invoices');
  assertTourAccess(profile, 'invoices');
  const href = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    Object.entries({ ...searchParams, ...o }).forEach(([k, v]) => v && p.set(k, v));
    return `?${p.toString()}`;
  };

  const suspKey = `${searchParams.q ?? ''}-${searchParams.status ?? ''}-${searchParams.page ?? '1'}`;

  return (
    <div className="space-y-5">
      {/* 1. Header Structure (Renders Instantly) */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Invoices</h1>
          <p className="text-sm text-ink-500">Create one directly, or from a quotation with “Convert to Invoice”.</p>
        </div>
        <Link href="/travinco_dashboard/invoices/new" prefetch={true} className="btn-primary">
          <Plus className="h-4 w-4" /> New invoice
        </Link>
      </div>

      {/* 2. Filter Pills Structure (Renders Instantly) */}
      <div className="flex flex-wrap gap-1.5">
        {['', ...STATUSES].map((s) => (
          <Link
            key={s || 'all'}
            href={href({ status: s || undefined, page: undefined })}
            className={`badge capitalize ${(searchParams.status ?? '') === s ? 'bg-brand-700 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50'}`}
          >
            {s || 'All'}
          </Link>
        ))}
      </div>

      {/* 3. Search Bar (Renders Instantly) */}
      <FilterBar>
        {searchParams.status && <input type="hidden" name="status" value={searchParams.status} />}
        <div className="relative min-w-[200px] sm:min-w-[220px] max-w-md flex-1 w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            name="q"
            defaultValue={searchParams.q}
            placeholder="Search invoice number, guest, phone…"
            className="input pl-9 w-full"
          />
        </div>
      </FilterBar>

      {/* 4. Table Card (Header loads immediately, rows show skeleton only while fetching) */}
      <div className="card overflow-hidden">
        <Suspense key={suspKey} fallback={<InvoicesTableSkeleton />}>
          <InvoicesTableContent searchParams={searchParams} isAdmin={isAdminRole(profile)} />
        </Suspense>
      </div>
    </div>
  );
}
