import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { StatCard } from '@/components/admin/stat-card';
import { formatDate, toLabel } from '@/lib/utils/format';
import { Package, CheckCircle2, Inbox, Sparkles } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [
    { count: totalPackagesCount },
    { count: publishedPackagesCount },
    { count: totalEnquiriesCount },
    { count: newEnquiriesCount },
    { data: recentEnquiries },
  ] = await Promise.all([
    supabase.from('travel_packages').select('id', { count: 'exact', head: true }),
    supabase
      .from('travel_packages')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published'),
    supabase.from('enquiries').select('id', { count: 'exact', head: true }),
    supabase.from('enquiries').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    supabase
      .from('enquiries')
      .select('id, enquiry_number, customer_name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">
          Welcome back, {profile.full_name.split(' ')[0]}
        </h1>
        <p className="text-sm text-ink-500">Here&apos;s what&apos;s happening today.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total packages" value={totalPackagesCount ?? 0} icon={Package} />
        <StatCard label="Published packages" value={publishedPackagesCount ?? 0} icon={CheckCircle2} />
        <StatCard label="Total enquiries" value={totalEnquiriesCount ?? 0} icon={Inbox} />
        <StatCard
          label="New enquiries"
          value={newEnquiriesCount ?? 0}
          icon={Sparkles}
          tone={newEnquiriesCount ? 'warning' : 'default'}
        />
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
