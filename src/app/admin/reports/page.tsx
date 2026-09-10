import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { redirect } from 'next/navigation';
import { formatCurrency } from '@/lib/utils/format';
import { ReportsCharts } from './reports-charts';
import Link from 'next/link';

function getDateRange(view: string | undefined): { from: string; to: string; label: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  switch (view) {
    case 'today':
      return { from: today, to: today, label: 'Today' };
    case 'week': {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      return { from: start.toISOString().slice(0, 10), to: today, label: 'This week' };
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
        label: 'Last month',
      };
    }
    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1);
      return { from: start.toISOString().slice(0, 10), to: today, label: 'This year' };
    }
    case 'month':
    default: {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start.toISOString().slice(0, 10), to: today, label: 'This month' };
    }
  }
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { view?: string; from?: string; to?: string };
}) {
  const profile = await requireProfile();
  if (!['accounts_staff', 'admin', 'super_admin'].includes(profile.role)) {
    redirect('/admin?error=forbidden');
  }

  const preset = getDateRange(searchParams.view);
  const from = searchParams.from || preset.from;
  const to = searchParams.to || preset.to;

  const supabase = await createClient();

  const [{ data: income }, { data: expenses }, { data: bookings }] = await Promise.all([
    supabase
      .from('income')
      .select('amount, category, income_date')
      .gte('income_date', from)
      .lte('income_date', to),
    supabase
      .from('expenses')
      .select('amount, category_id, expense_date, expense_categories(name)')
      .gte('expense_date', from)
      .lte('expense_date', to),
    supabase
      .from('bookings')
      .select('total_amount, balance_amount, booking_status')
      .gte('created_at', from)
      .lte('created_at', `${to}T23:59:59`),
  ]);

  const totalIncome = (income ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const totalExpenses = (expenses ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const netProfit = totalIncome - totalExpenses;
  const outstandingBalance = (bookings ?? [])
    .filter((b) => !['cancelled'].includes(b.booking_status))
    .reduce((s, b) => s + Number(b.balance_amount), 0);

  const incomeByCategory = Object.entries(
    (income ?? []).reduce<Record<string, number>>((acc, r) => {
      acc[r.category] = (acc[r.category] ?? 0) + Number(r.amount);
      return acc;
    }, {})
  ).map(([name, value]) => ({ name: name.replace('_', ' '), value }));

  const expensesByCategory = Object.entries(
    (expenses ?? []).reduce<Record<string, number>>((acc, r) => {
      const name = (r.expense_categories as { name: string } | null)?.name ?? 'Uncategorized';
      acc[name] = (acc[name] ?? 0) + Number(r.amount);
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const views = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This week' },
    { key: 'month', label: 'This month' },
    { key: 'last_month', label: 'Last month' },
    { key: 'year', label: 'This year' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Reports & Profit/Loss</h1>
        <p className="text-sm text-ink-500">
          {preset.label} ({from} to {to})
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {views.map((v) => (
          <Link
            key={v.key}
            href={`?view=${v.key}`}
            className={`btn-outline ${
              searchParams.view === v.key || (!searchParams.view && v.key === 'month')
                ? 'bg-brand-50 border-brand-300 text-brand-700'
                : ''
            }`}
          >
            {v.label}
          </Link>
        ))}
        <form className="flex items-center gap-2" method="get">
          <input type="date" name="from" defaultValue={from} className="input w-auto" />
          <input type="date" name="to" defaultValue={to} className="input w-auto" />
          <button type="submit" className="btn-outline">
            Custom range
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5">
          <p className="text-xs text-ink-400">Total income</p>
          <p className="mt-1 text-xl font-semibold text-brand-700">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-ink-400">Total expenses</p>
          <p className="mt-1 text-xl font-semibold text-red-600">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-ink-400">Net profit</p>
          <p className={`mt-1 text-xl font-semibold ${netProfit >= 0 ? 'text-brand-700' : 'text-red-600'}`}>
            {formatCurrency(netProfit)}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-ink-400">Outstanding balances</p>
          <p className="mt-1 text-xl font-semibold text-amber-700">{formatCurrency(outstandingBalance)}</p>
        </div>
      </div>

      <ReportsCharts incomeByCategory={incomeByCategory} expensesByCategory={expensesByCategory} />
    </div>
  );
}
