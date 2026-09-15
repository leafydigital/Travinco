import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { IncomeQuickAdd } from './income-quick-add';
import { DeleteFinanceRowButton } from '../delete-finance-row-button';
import { deleteIncome } from '../finance-actions';

const PAGE_SIZE = 25;

export default async function AdminIncomePage({
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

  const [{ data: income, count }, { data: customers }, { data: bookings }] = await Promise.all([
    supabase
      .from('income')
      .select('*, customers(full_name), bookings(booking_number)', { count: 'exact' })
      .order('income_date', { ascending: false })
      .range(from, to),
    supabase.from('customers').select('id, full_name').order('full_name').limit(200),
    supabase
      .from('bookings')
      .select('id, booking_number')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const total = (income ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Income</h1>
        <p className="text-sm text-ink-500">
          {count ?? 0} entries this page · {formatCurrency(total)} shown
        </p>
      </div>

      <IncomeQuickAdd customers={customers ?? []} bookings={bookings ?? []} />

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
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && <p className="text-sm text-ink-500">Page {page} of {totalPages}</p>}
    </div>
  );
}
