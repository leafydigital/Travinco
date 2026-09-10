import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { StatCard } from '@/components/admin/stat-card';
import { formatCurrency, formatDate, toLabel } from '@/lib/utils/format';
import { Inbox, ClipboardList, Wallet, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const canSeeFinance = ['accounts_staff', 'admin', 'super_admin'].includes(profile.role);

  const today = new Date().toISOString().slice(0, 10);

  const [
    { count: newEnquiriesCount },
    { count: followupsTodayCount },
    { count: confirmedBookingsCount },
    { data: recentEnquiries },
    financeTotals,
  ] = await Promise.all([
    supabase.from('enquiries').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    supabase
      .from('enquiry_followups')
      .select('id', { count: 'exact', head: true })
      .eq('followup_date', today)
      .eq('is_completed', false),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .in('booking_status', ['confirmed', 'partially_paid', 'fully_paid']),
    supabase
      .from('enquiries')
      .select('id, enquiry_number, customer_name, status, created_at, package_id')
      .order('created_at', { ascending: false })
      .limit(8),
    canSeeFinance
      ? Promise.all([
          supabase.from('income').select('amount'),
          supabase.from('expenses').select('amount'),
        ])
      : Promise.resolve(null),
  ]);

  let totalIncome = 0;
  let totalExpenses = 0;
  if (financeTotals) {
    const [incomeRes, expenseRes] = financeTotals;
    totalIncome = (incomeRes.data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
    totalExpenses = (expenseRes.data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">
          Welcome back, {profile.full_name.split(' ')[0]}
        </h1>
        <p className="text-sm text-ink-500">Here&apos;s what&apos;s happening today.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="New enquiries" value={newEnquiriesCount ?? 0} icon={Inbox} />
        <StatCard
          label="Follow-ups due today"
          value={followupsTodayCount ?? 0}
          icon={AlertCircle}
          tone={followupsTodayCount ? 'warning' : 'default'}
        />
        <StatCard label="Active bookings" value={confirmedBookingsCount ?? 0} icon={ClipboardList} />
        {canSeeFinance && (
          <StatCard
            label="Net profit"
            value={formatCurrency(totalIncome - totalExpenses)}
            icon={Wallet}
            tone={totalIncome - totalExpenses >= 0 ? 'success' : 'danger'}
          />
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-800">Recent enquiries</h2>
          <Link href="/admin/enquiries" className="text-sm text-brand-600 hover:underline">
            View all
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-5 py-2.5">Enquiry #</th>
                <th className="px-5 py-2.5">Customer</th>
                <th className="px-5 py-2.5">Status</th>
                <th className="px-5 py-2.5">Date</th>
              </tr>
            </thead>
            <tbody>
              {(recentEnquiries ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-ink-400">
                    No enquiries yet.
                  </td>
                </tr>
              )}
              {(recentEnquiries ?? []).map((e) => (
                <tr key={e.id} className="border-b border-ink-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-ink-700">
                    <Link href={`/admin/enquiries/${e.id}`} className="hover:underline">
                      {e.enquiry_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-ink-600">{e.customer_name}</td>
                  <td className="px-5 py-3">
                    <span className="badge bg-ink-100 text-ink-700">{toLabel(e.status)}</span>
                  </td>
                  <td className="px-5 py-3 text-ink-500">{formatDate(e.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
