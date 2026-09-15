import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import Link from 'next/link';
import { Search } from 'lucide-react';

const PAGE_SIZE = 25;

function buildHref(sp: Record<string, string | undefined>, overrides: Record<string, string | undefined>) {
  const merged = { ...sp, ...overrides };
  const params = new URLSearchParams();
  Object.entries(merged).forEach(([k, v]) => v && params.set(k, v));
  return `?${params.toString()}`;
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; payment?: string; page?: string };
}) {
  await requireProfile();
  const supabase = await createClient();

  const page = Math.max(1, Number(searchParams.page ?? 1));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('bookings')
    .select(
      'id, booking_number, travel_start_date, total_amount, amount_received, balance_amount, payment_status, booking_status, customers(full_name, phone), travel_packages(title)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (searchParams.status) query = query.eq('booking_status', searchParams.status);
  if (searchParams.payment) query = query.eq('payment_status', searchParams.payment);
  if (searchParams.q) {
    query = query.or(`booking_number.ilike.%${searchParams.q}%`);
  }

  const { data: bookings, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Bookings</h1>
        <p className="text-sm text-ink-500">{count ?? 0} total bookings</p>
      </div>

      <form className="flex flex-wrap items-center gap-3" method="get">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            name="q"
            defaultValue={searchParams.q}
            placeholder="Search booking number…"
            className="input pl-9"
          />
        </div>
        <select name="status" defaultValue={searchParams.status ?? ''} className="input w-auto">
          <option value="">All statuses</option>
          <option value="inquiry">Inquiry</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="partially_paid">Partially paid</option>
          <option value="fully_paid">Fully paid</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
        </select>
        <select name="payment" defaultValue={searchParams.payment ?? ''} className="input w-auto">
          <option value="">All payment statuses</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="refunded">Refunded</option>
        </select>
        <button type="submit" className="btn-outline">
          Filter
        </button>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3">Booking #</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Package</th>
                <th className="px-5 py-3">Travel date</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Balance</th>
                <th className="px-5 py-3">Payment</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {(bookings ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-ink-400">
                    No bookings yet.
                  </td>
                </tr>
              )}
              {(bookings ?? []).map((b) => (
                <tr key={b.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
                  <td className="px-5 py-3">
                    <Link href={`/admin/bookings/${b.id}`} className="font-medium text-ink-800 hover:text-brand-700">
                      {b.booking_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    {(() => {
                      const cust = b.customers as { full_name: string; phone: string } | { full_name: string; phone: string }[] | null;
                      const c = Array.isArray(cust) ? cust[0] ?? null : cust;
                      return (
                        <>
                          <p className="text-ink-700">{c?.full_name ?? '—'}</p>
                          <p className="text-xs text-ink-400">{c?.phone}</p>
                        </>
                      );
                    })()}
                  </td>
                  <td className="px-5 py-3 text-ink-600">
                    {(() => {
                      const pkg = b.travel_packages as { title: string } | { title: string }[] | null;
                      return (Array.isArray(pkg) ? pkg[0]?.title : pkg?.title) ?? '—';
                    })()}
                  </td>
                  <td className="px-5 py-3 text-ink-500">{formatDate(b.travel_start_date)}</td>
                  <td className="px-5 py-3 text-ink-700">{formatCurrency(b.total_amount)}</td>
                  <td className="px-5 py-3 text-ink-700">{formatCurrency(b.balance_amount)}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={b.payment_status} />
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={b.booking_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3 text-sm text-ink-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={buildHref(searchParams, { page: String(page - 1) })} className="btn-outline px-3 py-1.5">
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link href={buildHref(searchParams, { page: String(page + 1) })} className="btn-outline px-3 py-1.5">
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
