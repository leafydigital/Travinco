import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { ExpenseQuickAdd } from './expense-quick-add';
import { DeleteFinanceRowButton } from '../delete-finance-row-button';
import { deleteExpense } from '../finance-actions';

const PAGE_SIZE = 25;

export default async function AdminExpensesPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
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
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Expenses</h1>
        <p className="text-sm text-ink-500">
          {count ?? 0} entries this page · {formatCurrency(total)} shown
        </p>
      </div>

      <ExpenseQuickAdd categories={categories ?? []} />

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
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && <p className="text-sm text-ink-500">Page {page} of {totalPages}</p>}
    </div>
  );
}
