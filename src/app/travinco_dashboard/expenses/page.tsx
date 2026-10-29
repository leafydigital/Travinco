import { createClient } from '@/lib/supabase/server';
import { requireProfile, assertPageAccess } from '@/lib/supabase/auth-helpers';
import { redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { ExpenseQuickAdd } from './expense-quick-add';
import { ExpenseRowActions } from './expense-row-actions';
import { paymentMethodLabel } from '@/lib/payment-methods';
import { Suspense } from 'react';

const PAGE_SIZE = 25;

type SearchParams = { page?: string };

/* ── skeleton ─────────────────────────────────────────────── */
function ExpensesTableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-ink-50 last:border-0">
          <td className="px-3 sm:px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-ink-100" /></td>
          <td className="px-3 sm:px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-ink-100" /></td>
          <td className="px-3 sm:px-4 py-3"><div className="h-4 w-full animate-pulse rounded bg-ink-100" /></td>
          <td className="hidden md:table-cell px-3 sm:px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-ink-100" /></td>
          <td className="hidden sm:table-cell px-3 sm:px-4 py-3"><div className="h-4 w-16 animate-pulse rounded bg-ink-100" /></td>
          <td className="px-3 sm:px-4 py-3 text-right"><div className="h-4 w-16 animate-pulse rounded bg-ink-100 ml-auto" /></td>
          <td className="px-3 sm:px-4 py-3 text-right"><div className="h-6 w-12 animate-pulse rounded bg-ink-100 ml-auto" /></td>
        </tr>
      ))}
    </>
  );
}

/* ── data rows (streamed) ─────────────────────────────────── */
async function ExpensesContent({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  await assertPageAccess(profile, 'expenses');
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
  const canEdit = ['accounts_staff', 'admin', 'super_admin'].includes(profile.role);

  const supabase = await createClient();
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [
    { data: expensesData, count: expensesCount, error: expensesError },
    { data: categories },
    { data: deletedSettingsData },
  ] = await Promise.all([
    supabase
      .from('expenses')
      .select('*, expense_categories(id, name)', { count: 'exact' })
      .order('expense_date', { ascending: false })
      .range(from, to),
    supabase.from('expense_categories').select('id, name').eq('is_active', true).order('sort_order'),
    supabase.from('website_settings').select('key').like('key', 'deleted_expense_%'),
  ]);

  if (expensesError) {
    console.error('Error fetching expenses:', expensesError.message);
  }

  const deletedExpenseKeys = new Set(
    (deletedSettingsData || []).map((s: { key: string }) => s.key.replace('deleted_expense_', ''))
  );

  const rawExpenses = expensesData ?? [];
  const filteredExpenses = rawExpenses.filter(
    (r: any) =>
      r &&
      r.is_deleted !== true &&
      r.is_deleted !== 'true' &&
      r.is_deleted !== 1 &&
      !deletedExpenseKeys.has(r.id)
  );
  const total = filteredExpenses.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalPages = Math.max(1, Math.ceil(((expensesCount ?? filteredExpenses.length) || 0) / PAGE_SIZE));

  return (
    <>
      {/* Quick-add form needs categories — render outside table */}
      <tr className="hidden" aria-hidden>
        <td>
          {/* categories prop passed via server component above the table */}
        </td>
      </tr>
      {filteredExpenses.length === 0 && (
        <tr>
          <td colSpan={7} className="px-4 py-10 text-center text-ink-400">
            No expenses recorded yet.
          </td>
        </tr>
      )}
      {filteredExpenses.map((row) => (
        <tr key={row.id} className="border-b border-ink-50 last:border-0 hover:bg-sand-50/40 transition-colors">
          <td className="px-3 sm:px-4 py-3 text-ink-600 whitespace-nowrap text-xs sm:text-sm">{formatDate(row.expense_date)}</td>
          <td className="px-3 sm:px-4 py-3 text-ink-700 font-medium whitespace-nowrap text-xs sm:text-sm">
            {(() => {
              const cat = row.expense_categories as { name: string } | { name: string }[] | null;
              return (Array.isArray(cat) ? cat[0]?.name : cat?.name) ?? '—';
            })()}
          </td>
          <td className="px-3 sm:px-4 py-3 text-ink-600 max-w-[160px] sm:max-w-xs truncate text-xs sm:text-sm" title={row.description || undefined}>
            {row.description || '—'}
          </td>
          <td className="hidden md:table-cell px-3 sm:px-4 py-3 text-ink-600 max-w-[120px] truncate text-xs sm:text-sm">{row.supplier ?? '—'}</td>
          <td className="hidden sm:table-cell px-3 sm:px-4 py-3 text-ink-500 whitespace-nowrap text-xs sm:text-sm">{paymentMethodLabel(row.payment_method, row.notes)}</td>
          <td className="px-3 sm:px-4 py-3 text-right font-medium text-red-600 whitespace-nowrap text-xs sm:text-sm">
            {formatCurrency(row.amount)}
          </td>
          <td className="px-3 sm:px-4 py-3 text-right whitespace-nowrap">
            <ExpenseRowActions
              row={row}
              categories={categories ?? []}
              canEdit={canEdit}
              isAdmin={isAdmin}
            />
          </td>
        </tr>
      ))}
      {totalPages > 1 && (
        <tr>
          <td colSpan={7} className="px-4 py-3 text-sm text-ink-500">
            Page {page} of {totalPages}
          </td>
        </tr>
      )}
      {/* Summary footer */}
      <tr className="border-t border-ink-100 bg-ink-50/50 font-medium text-xs sm:text-sm">
        <td colSpan={3} className="px-3 sm:px-4 py-3 text-ink-600 sm:hidden">
          {(expensesCount ?? filteredExpenses.length) || 0} entries · Total shown
        </td>
        <td colSpan={4} className="hidden sm:table-cell md:hidden px-3 sm:px-4 py-3 text-ink-600">
          {(expensesCount ?? filteredExpenses.length) || 0} entries · Total shown
        </td>
        <td colSpan={5} className="hidden md:table-cell px-3 sm:px-4 py-3 text-ink-600">
          {(expensesCount ?? filteredExpenses.length) || 0} entries · Total shown
        </td>
        <td className="px-3 sm:px-4 py-3 text-right text-red-600 whitespace-nowrap font-semibold">{formatCurrency(total)}</td>
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
export default async function AdminExpensesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireProfile();
  await assertPageAccess(profile, 'expenses');

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
        <div className="w-full overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-3 sm:px-4 py-3 whitespace-nowrap">Date</th>
                <th className="px-3 sm:px-4 py-3 whitespace-nowrap">Category</th>
                <th className="px-3 sm:px-4 py-3">Description</th>
                <th className="hidden md:table-cell px-3 sm:px-4 py-3">Supplier</th>
                <th className="hidden sm:table-cell px-3 sm:px-4 py-3 whitespace-nowrap">Method</th>
                <th className="px-3 sm:px-4 py-3 text-right whitespace-nowrap">Amount</th>
                <th className="px-3 sm:px-4 py-3 text-right whitespace-nowrap">Actions</th>
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
