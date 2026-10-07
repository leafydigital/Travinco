import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { formatCurrency, formatDate, toLabel } from '@/lib/utils/format';
import {
  Sparkles,
  PhoneCall,
  Flame,
  Inbox,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Package,
  Calendar,
  Layers,
  Award,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PackagePerformance {
  id: string;
  title: string;
  slug: string;
  category: string;
  duration_days: number;
  duration_nights: number;
  base_price: number;
  cover_image_url: string | null;
  seats_booked: number;
  totalBookings: number;
  totalRevenue: number;
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const profile = await requireProfile();
  const supabase = await createClient();

  // Current month date calculations
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth();
  const currentMonthStart = new Date(currentYear, currentMonthIndex, 1).toISOString().slice(0, 10);
  const currentMonthEnd = new Date(currentYear, currentMonthIndex + 1, 0).toISOString().slice(0, 10);
  const currentMonthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  // 1. Fetch 4 Lead / Enquiry Counts
  const [
    { count: freshLeadsCount },
    { count: followUpsCount },
    { count: interestedCount },
    { count: enquiredCount },
    { data: currentMonthIncomeData },
    { data: currentMonthExpenseData },
    { data: allBookingsData },
    { data: publishedPackagesData },
    { data: recentEnquiries },
  ] = await Promise.all([
    // Fresh Lead (status = 'new')
    supabase.from('enquiries').select('id', { count: 'exact', head: true }).eq('status', 'new'),

    // Follow Up (status = 'follow_up')
    supabase.from('enquiries').select('id', { count: 'exact', head: true }).eq('status', 'follow_up'),

    // Interested (status in contacted, quotation_sent, negotiation)
    supabase
      .from('enquiries')
      .select('id', { count: 'exact', head: true })
      .in('status', ['contacted', 'quotation_sent', 'negotiation']),

    // Enquired (all enquiries)
    supabase.from('enquiries').select('id', { count: 'exact', head: true }),

    // Current Month Income
    supabase
      .from('income')
      .select('amount')
      .gte('income_date', currentMonthStart)
      .lte('income_date', currentMonthEnd),

    // Current Month Expense
    supabase
      .from('expenses')
      .select('amount')
      .gte('expense_date', currentMonthStart)
      .lte('expense_date', currentMonthEnd),

    // Bookings for Top Selling Packages calculation
    supabase
      .from('bookings')
      .select('id, package_id, total_amount, booking_status')
      .not('booking_status', 'eq', 'cancelled'),

    // Travel Packages
    supabase
      .from('travel_packages')
      .select('id, title, slug, category, duration_days, duration_nights, base_price, cover_image_url, seats_booked, status, is_featured')
      .order('seats_booked', { ascending: false })
      .limit(15),

    // Recent Enquiries
    supabase
      .from('enquiries')
      .select('id, enquiry_number, customer_name, status, created_at, destination')
      .order('created_at', { ascending: false })
      .limit(6),
  ]);

  // Compute Current Month Income & Expense Totals
  const totalIncome = (currentMonthIncomeData ?? []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalExpenses = (currentMonthExpenseData ?? []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const netProfit = totalIncome - totalExpenses;

  // Aggregate Top Selling Packages
  const bookingsByPackage = new Map<string, { count: number; revenue: number }>();
  (allBookingsData ?? []).forEach((b) => {
    if (!b.package_id) return;
    const existing = bookingsByPackage.get(b.package_id) || { count: 0, revenue: 0 };
    existing.count += 1;
    existing.revenue += Number(b.total_amount || 0);
    bookingsByPackage.set(b.package_id, existing);
  });

  const packagesMap = new Map<string, PackagePerformance>();
  (publishedPackagesData ?? []).forEach((pkg) => {
    const bookingStats = bookingsByPackage.get(pkg.id) || { count: 0, revenue: 0 };
    packagesMap.set(pkg.id, {
      id: pkg.id,
      title: pkg.title,
      slug: pkg.slug,
      category: pkg.category,
      duration_days: pkg.duration_days,
      duration_nights: pkg.duration_nights,
      base_price: pkg.base_price,
      cover_image_url: pkg.cover_image_url,
      seats_booked: pkg.seats_booked || 0,
      totalBookings: bookingStats.count,
      totalRevenue: bookingStats.revenue,
    });
  });

  // Sort top selling packages: by total bookings descending, then by seats booked or revenue
  const topSellingPackages: PackagePerformance[] = Array.from(packagesMap.values())
    .sort((a, b) => {
      if (b.totalBookings !== a.totalBookings) {
        return b.totalBookings - a.totalBookings;
      }
      if (b.totalRevenue !== a.totalRevenue) {
        return b.totalRevenue - a.totalRevenue;
      }
      return b.seats_booked - a.seats_booked;
    })
    .slice(0, 5);

  return (
    <div className="space-y-8">
      {searchParams?.error === 'forbidden' && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm"
        >
          <span className="font-semibold">Access restricted:</span> Your account role does not have permission to access that section.
        </div>
      )}

      {/* Welcome Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">
            Welcome back, {profile.full_name.split(' ')[0]}
          </h1>
          <p className="text-sm text-ink-500">
            Overview of your leads pipeline, monthly finances, and top performing packages.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-600 shadow-xs">
          <Calendar className="h-3.5 w-3.5 text-brand-600" />
          <span>{currentMonthName}</span>
        </div>
      </div>

      {/* 1. Four Lead Cards */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400">
            Lead Status & Pipeline
          </h2>
          <Link href="/admin/enquiries" className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline">
            View all enquiries →
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Fresh Lead */}
          <Link
            href="/admin/enquiries?status=new"
            className="card-hover group relative overflow-hidden p-5 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Fresh Lead
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform shadow-xs">
                <Sparkles className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight text-ink-900">
              {freshLeadsCount ?? 0}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-ink-500">
              <span>New incoming leads</span>
              <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-emerald-600 ml-auto" />
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500/30 group-hover:bg-emerald-500 transition-colors" />
          </Link>

          {/* Card 2: Follow Up */}
          <Link
            href="/admin/enquiries?status=follow_up"
            className="card-hover group relative overflow-hidden p-5 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                Follow Up
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform shadow-xs">
                <PhoneCall className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight text-ink-900">
              {followUpsCount ?? 0}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-ink-500">
              <span>Follow-ups scheduled</span>
              <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-amber-600 ml-auto" />
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500/30 group-hover:bg-amber-500 transition-colors" />
          </Link>

          {/* Card 3: Interested */}
          <Link
            href="/admin/enquiries"
            className="card-hover group relative overflow-hidden p-5 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                Interested
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 group-hover:scale-110 transition-transform shadow-xs">
                <Flame className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight text-ink-900">
              {interestedCount ?? 0}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-ink-500">
              <span>Quotes & negotiations</span>
              <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-brand-600 ml-auto" />
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand-500/30 group-hover:bg-brand-500 transition-colors" />
          </Link>

          {/* Card 4: Enquired */}
          <Link
            href="/admin/enquiries"
            className="card-hover group relative overflow-hidden p-5 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-700">
                Enquired
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-100 text-ink-600 group-hover:scale-110 transition-transform shadow-xs">
                <Inbox className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight text-ink-900">
              {enquiredCount ?? 0}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-ink-500">
              <span>Total enquiries pipeline</span>
              <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-ink-600 ml-auto" />
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-ink-400/30 group-hover:bg-ink-600 transition-colors" />
          </Link>
        </div>
      </div>

      {/* 2. Current Month Income and Expense */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400">
              Monthly Financial Overview
            </h2>
            <span className="rounded bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-600">
              {currentMonthName}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-ink-500">Net:</span>
            <span className={`font-semibold ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {formatCurrency(netProfit)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Current Month Income Card */}
          <Link
            href="/admin/income"
            className="card-hover group relative overflow-hidden p-6 transition-all border-emerald-100/70 bg-gradient-to-br from-white via-white to-emerald-50/30"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                  Current Month Income
                </span>
                <p className="mt-3 text-3xl font-bold tracking-tight text-ink-900">
                  {formatCurrency(totalIncome)}
                </p>
                <p className="mt-1 text-xs text-ink-500">
                  Recorded income for {currentMonthName} ({(currentMonthIncomeData ?? []).length} receipts)
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-inner">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-emerald-100/60 pt-3 text-xs text-emerald-700 font-medium">
              <span>View income transactions</span>
              <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
          </Link>

          {/* Current Month Expense Card */}
          <Link
            href="/admin/expenses"
            className="card-hover group relative overflow-hidden p-6 transition-all border-rose-100/70 bg-gradient-to-br from-white via-white to-rose-50/30"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100/80 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
                  <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
                  Current Month Expense
                </span>
                <p className="mt-3 text-3xl font-bold tracking-tight text-ink-900">
                  {formatCurrency(totalExpenses)}
                </p>
                <p className="mt-1 text-xs text-ink-500">
                  Recorded expenses for {currentMonthName} ({(currentMonthExpenseData ?? []).length} vouchers)
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-all shadow-inner">
                <TrendingDown className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-rose-100/60 pt-3 text-xs text-rose-700 font-medium">
              <span>View expense records</span>
              <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-rose-400 to-red-500" />
          </Link>
        </div>
      </div>

      {/* 3. Top Selling Packages */}
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-ink-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between bg-sand-50/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
              <Award className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink-900">
                Top Selling Packages
              </h2>
              <p className="text-xs text-ink-500">
                Highest performing itineraries by bookings count and popularity
              </p>
            </div>
          </div>
          <Link
            href="/admin/packages"
            className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline inline-flex items-center gap-1"
          >
            All packages <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {topSellingPackages.length === 0 ? (
          <div className="p-8 text-center text-ink-400">
            <Package className="mx-auto h-8 w-8 text-ink-300 mb-2" />
            <p className="text-sm font-medium text-ink-600">No packages available yet</p>
            <p className="text-xs text-ink-400 mt-1">Create your first travel package to start tracking bookings.</p>
            <Link href="/admin/packages/new" className="btn-primary mt-4 inline-flex text-xs">
              Add New Package
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-ink-100">
            {topSellingPackages.map((pkg, index) => {
              const rank = index + 1;
              const isTop3 = rank <= 3;
              return (
                <div
                  key={pkg.id}
                  className="flex flex-col gap-4 p-5 transition-colors hover:bg-sand-50/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  {/* Left: Rank & Package details */}
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Rank Badge */}
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                        rank === 1
                          ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-400/50'
                          : rank === 2
                          ? 'bg-slate-200 text-slate-800'
                          : rank === 3
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-ink-100 text-ink-600'
                      }`}
                    >
                      #{rank}
                    </span>

                    {/* Thumbnail Image */}
                    <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-ink-100 border border-ink-200/60 shadow-2xs">
                      {pkg.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={pkg.cover_image_url}
                          alt={pkg.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-ink-400">
                          <Package className="h-5 w-5" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/packages/${pkg.id}`}
                          className="font-semibold text-sm text-ink-900 hover:text-brand-700 truncate"
                        >
                          {pkg.title}
                        </Link>
                        <span className="badge bg-brand-50 text-brand-700 text-[10px] font-medium capitalize">
                          {toLabel(pkg.category)}
                        </span>
                        {isTop3 && (
                          <span className="badge bg-amber-50 text-amber-700 text-[10px] font-medium inline-flex items-center gap-0.5">
                            <Flame className="h-3 w-3 text-amber-600" /> Hot Seller
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-ink-400" />
                          {pkg.duration_days}D / {pkg.duration_nights}N
                        </span>
                        <span>•</span>
                        <span>Starting from <strong>{formatCurrency(pkg.base_price)}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Booking metrics & action */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 border-t border-ink-100 pt-3 sm:border-0 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <p className="text-sm font-bold text-brand-800">
                        {pkg.totalBookings > 0
                          ? `${pkg.totalBookings} ${pkg.totalBookings === 1 ? 'Booking' : 'Bookings'}`
                          : `${pkg.seats_booked} Seats Booked`}
                      </p>
                      <p className="text-xs text-ink-500">
                        {pkg.totalRevenue > 0
                          ? `Revenue: ${formatCurrency(pkg.totalRevenue)}`
                          : 'Published Active'}
                      </p>
                    </div>

                    <Link
                      href={`/admin/packages/${pkg.id}`}
                      className="btn-outline py-1.5 px-3 text-xs shrink-0"
                    >
                      Manage
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Recent Enquiries Quick View */}
      <div className="card">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-ink-800">Recent enquiries</h2>
            <span className="badge bg-ink-100 text-ink-600 text-[10px]">Latest</span>
          </div>
          <Link href="/admin/enquiries" className="text-xs font-medium text-brand-600 hover:underline">
            View all enquiries →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-5 py-2.5">Enquiry #</th>
                <th className="px-5 py-2.5">Customer</th>
                <th className="px-5 py-2.5">Destination</th>
                <th className="px-5 py-2.5">Status</th>
                <th className="px-5 py-2.5">Date</th>
              </tr>
            </thead>
            <tbody>
              {(recentEnquiries ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-ink-400">
                    No enquiries recorded yet.
                  </td>
                </tr>
              )}
              {(recentEnquiries ?? []).map((e) => (
                <tr key={e.id} className="border-b border-ink-50 last:border-0 hover:bg-sand-50/40 transition-colors">
                  <td className="px-5 py-3 font-medium text-ink-700">
                    <Link href={`/admin/enquiries/${e.id}`} className="text-brand-700 hover:underline font-semibold">
                      {e.enquiry_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-ink-800 font-medium">{e.customer_name}</td>
                  <td className="px-5 py-3 text-ink-600">{e.destination || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`badge text-[11px] ${
                      e.status === 'new'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : e.status === 'follow_up'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-ink-100 text-ink-700'
                    }`}>
                      {toLabel(e.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-ink-500 text-xs">{formatDate(e.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

