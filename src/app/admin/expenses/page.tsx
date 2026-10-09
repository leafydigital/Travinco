import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { ExpenseQuickAdd } from './expense-quick-add';
import { DeleteFinanceRowButton } from '../delete-finance-row-button';
import { deleteExpense } from '../finance-actions';
import { Suspense } from 'react';

const PAGE_SIZE = 25;

type SearchParams = { page?: string };

/* ── skeleton ─────────────────────────────────────────────── */
function ExpensesTableSkeleton() {
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
async function ExpensesContent({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  if (!['accounts_staff', 'admin', 'super_admin'].includes(profile.role)) {
    redirect('/admin?error=forbidden');
  }

  const supabase = await createClient();
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [{ data: expenses, count }, { data: categories }] = await Promise.all([
    supabase
      .from('expenses')
      .select('*, expense_categories(name)', { count: 'exact' })
      .order('expense_date', { ascending: false })
      .range(from, to),
    supabase.from('expense_categories').select('id, name').eq('is_active', true).order('sort_order'),
  ]);

  const total = (expenses ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <>
      {/* Quick-add form needs categories — render outside table */}
      <tr className="hidden" aria-hidden>
        <td>
          {/* categories prop passed via server component above the table */}
        </td>
      </tr>
      {(expenses ?? []).length === 0 && (
        <tr>
          <td colSpan={7} className="px-5 py-10 text-center text-ink-400">
            No expenses recorded yet.
          </td>
        </tr>
      )}
      {(expenses ?? []).map((row) => (
        <tr key={row.id} className="border-b border-ink-50 last:border-0">
          <td className="px-5 py-3 text-ink-600">{formatDate(row.expense_date)}</td>
          <td className="px-5 py-3 text-ink-500">{row.expense_number}</td>
          <td className="px-5 py-3 text-ink-600">
            {(() => {
              const cat = row.expense_categories as { name: string } | { name: string }[] | null;
              return (Array.isArray(cat) ? cat[0]?.name : cat?.name) ?? '—';
            })()}
          </td>
          <td className="px-5 py-3 text-ink-600">{row.supplier ?? '—'}</td>
          <td className="px-5 py-3 capitalize text-ink-500">{row.payment_method.replace('_', ' ')}</td>
          <td className="px-5 py-3 text-right font-medium text-red-600">
            {formatCurrency(row.amount)}
          </td>
          <td className="px-5 py-3 text-right">
            <DeleteFinanceRowButton id={row.id} action={deleteExpense} />
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
      {/* Summary footer */}
      <tr className="border-t border-ink-100 bg-ink-50/50 font-medium">
        <td colSpan={5} className="px-5 py-3 text-ink-600">
          {count ?? 0} entries · Total shown
        </td>
        <td className="px-5 py-3 text-right text-red-600">{formatCurrency(total)}</td>
        <td />
      </tr>
    </>
  );
}

/* ── QuickAdd streamed (needs categories) ─────────────────── */
async function ExpensesQuickAddSection({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  if (!['accounts_staff', 'admin', 'super_admin'].includes(profile.role)) {
    return null;
  }
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from('expense_categories')
    .select('id, name')
    .eq('is_active', true)
    .order('sort_order');

  return <ExpenseQuickAdd categories={categories ?? []} />;
}

/* ── page shell (instant) ─────────────────────────────────── */
export default function AdminExpensesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Expenses</h1>
        <p className="text-sm text-ink-500">Track and manage all business expenses.</p>
      </div>

      <Suspense fallback={<div className="h-20 animate-pulse rounded-xl bg-ink-100" />}>
        <ExpensesQuickAddSection searchParams={searchParams} />
      </Suspense>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">#</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Supplier</th>
                <th className="px-5 py-3">Method</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              <Suspense fallback={<ExpensesTableSkeleton />}>
                <ExpensesContent searchParams={searchParams} />
              </Suspense>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
