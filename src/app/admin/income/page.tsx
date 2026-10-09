import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { IncomeQuickAdd } from './income-quick-add';
import { DeleteFinanceRowButton } from '../delete-finance-row-button';
import { deleteIncome } from '../finance-actions';
import { Suspense } from 'react';

const PAGE_SIZE = 25;

type SearchParams = { page?: string };

/* ── skeleton ─────────────────────────────────────────────── */
function IncomeTableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-ink-50 last:border-0">
          {Array.from({ length: 7 }).map((_, j) => (
            <td key={j} className="px-5 py-3">
              <div className="h-4 w-full animate-pulse rounded bg-ink-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/* ── data rows (streamed) ─────────────────────────────────── */
async function IncomeContent({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  if (!['accounts_staff', 'admin', 'super_admin'].includes(profile.role)) {
    redirect('/admin?error=forbidden');
  }

  const supabase = await createClient();
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [{ data: income, count }] = await Promise.all([
    supabase
      .from('income')
      .select('*, customers(full_name), bookings(booking_number)', { count: 'exact' })
      .order('income_date', { ascending: false })
      .range(from, to),
  ]);

  const total = (income ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <>
      {(income ?? []).length === 0 && (
        <tr>
          <td colSpan={7} className="px-5 py-10 text-center text-ink-400">
            No income recorded yet.
          </td>
        </tr>
      )}
      {(income ?? []).map((row) => (
        <tr key={row.id} className="border-b border-ink-50 last:border-0">
          <td className="px-5 py-3 text-ink-600">{formatDate(row.income_date)}</td>
          <td className="px-5 py-3 text-ink-500">{row.income_number}</td>
          <td className="px-5 py-3 capitalize text-ink-600">{row.category.replace('_', ' ')}</td>
          <td className="px-5 py-3 text-ink-600">
            {(() => {
              const cust = row.customers as { full_name: string } | { full_name: string }[] | null;
              const bk = row.bookings as { booking_number: string } | { booking_number: string }[] | null;
              const customerName = (Array.isArray(cust) ? cust[0]?.full_name : cust?.full_name) ?? '—';
              const booking = Array.isArray(bk) ? bk[0] : bk;
              return (
                <>
                  {customerName}
                  {booking?.booking_number && ` · ${booking.booking_number}`}
                </>
              );
            })()}
          </td>
          <td className="px-5 py-3 capitalize text-ink-500">{row.payment_method.replace('_', ' ')}</td>
          <td className="px-5 py-3 text-right font-medium text-brand-700">
            {formatCurrency(row.amount)}
          </td>
          <td className="px-5 py-3 text-right">
            <DeleteFinanceRowButton id={row.id} action={deleteIncome} />
          </td>
        </tr>
      ))}
      {totalPages > 1 && (
        <tr>
          <td colSpan={7} className="px-5 py-3 text-sm text-ink-500">
            Page {page} of {totalPages}
          </td>
        </tr>
      )}
      <tr className="border-t border-ink-100 bg-ink-50/50 font-medium">
        <td colSpan={5} className="px-5 py-3 text-ink-600">
          {count ?? 0} entries · Total shown
        </td>
        <td className="px-5 py-3 text-right text-brand-700">{formatCurrency(total)}</td>
        <td />
      </tr>
    </>
  );
}

/* ── QuickAdd streamed (needs customers + bookings lists) ─── */
async function IncomeQuickAddSection() {
  const profile = await requireProfile();
  if (!['accounts_staff', 'admin', 'super_admin'].includes(profile.role)) {
    return null;
  }
  const supabase = await createClient();
  const [{ data: customers }, { data: bookings }] = await Promise.all([
    supabase.from('customers').select('id, full_name').order('full_name').limit(200),
    supabase
      .from('bookings')
      .select('id, booking_number')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  return <IncomeQuickAdd customers={customers ?? []} bookings={bookings ?? []} />;
}

/* ── page shell (instant) ─────────────────────────────────── */
export default function AdminIncomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Income</h1>
        <p className="text-sm text-ink-500">Track and manage all business income.</p>
      </div>

      <Suspense fallback={<div className="h-20 animate-pulse rounded-xl bg-ink-100" />}>
        <IncomeQuickAddSection />
      </Suspense>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">#</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Customer / booking</th>
                <th className="px-5 py-3">Method</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              <Suspense fallback={<IncomeTableSkeleton />}>
                <IncomeContent searchParams={searchParams} />
              </Suspense>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
