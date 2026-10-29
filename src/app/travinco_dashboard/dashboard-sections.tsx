import { createClient } from '@/lib/supabase/server';
import { formatCurrency, formatDate, toLabel } from '@/lib/utils/format';
import {
  UserPlus,
  PhoneCall,
  Flame,
  Inbox,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Package,
  Award,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

/**
 * Dashboard sections. Each one fetches only its own data and is rendered inside
 * its own <Suspense> boundary on the dashboard page, so the page shell and the
 * fast sections stream to the browser without waiting on the slowest query.
 */

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

const notDeleted = 'is_deleted.is.null,is_deleted.eq.false';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Bounds (YYYY-MM-DD) and label for the current month in India time, computed on
 * every request — so it rolls over at IST midnight on the 1st regardless of the
 * server's timezone (toISOString on local dates used to shift the bounds a day).
 */
export function currentMonthInfo() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value); // 1-12
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, '0');
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
    name: `${MONTH_NAMES[month - 1]} ${year}`,
  };
}

/* ------------------------------------------------------------------ */
/* 1. Leads pipeline                                                   */
/* ------------------------------------------------------------------ */

export async function LeadsPipelineSection() {
  const supabase = await createClient();
  const countByStatus = (status: string) =>
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .or(notDeleted)
      .eq('status', status);

  const [
    { count: freshLeadsCount },
    { count: followUpsCount },
    { count: interestedCount },
    { count: enquiredCount },
  ] = await Promise.all([
    countByStatus('fresh_lead'),
    countByStatus('follow_up'),
    countByStatus('interested'),
    countByStatus('enquired'),
  ]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400">
          Leads Pipeline
        </h2>
        <Link href="/travinco_dashboard/leads" className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline">
          View all leads →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Fresh Leads */}
        <Link
          href="/travinco_dashboard/leads?status=fresh_lead"
          className="card-hover group relative overflow-hidden p-5 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Fresh Leads
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform shadow-xs">
              <UserPlus className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-ink-900">
            {freshLeadsCount ?? 0}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-ink-500">
            <span>New incoming leads</span>
            <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-blue-600 ml-auto" />
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500/30 group-hover:bg-blue-500 transition-colors" />
        </Link>

        {/* Card 2: Follow Up */}
        <Link
          href="/travinco_dashboard/leads?status=follow_up"
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
          href="/travinco_dashboard/leads?status=interested"
          className="card-hover group relative overflow-hidden p-5 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Interested
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform shadow-xs">
              <Flame className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-ink-900">
            {interestedCount ?? 0}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-ink-500">
            <span>Interested prospects</span>
            <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-emerald-600 ml-auto" />
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500/30 group-hover:bg-emerald-500 transition-colors" />
        </Link>

        {/* Card 4: Enquired */}
        <Link
          href="/travinco_dashboard/leads?status=enquired"
          className="card-hover group relative overflow-hidden p-5 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-700">
              Enquired
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 group-hover:scale-110 transition-transform shadow-xs">
              <Inbox className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-ink-900">
            {enquiredCount ?? 0}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-ink-500">
            <span>Customer enquiries</span>
            <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-purple-600 ml-auto" />
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500/30 group-hover:bg-purple-500 transition-colors" />
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Monthly financial overview                                       */
/* ------------------------------------------------------------------ */

export async function FinancialOverviewSection() {
  const supabase = await createClient();
  const { start: currentMonthStart, end: currentMonthEnd, name: currentMonthName } = currentMonthInfo();

  const [
    { data: currentMonthIncomeData },
    { data: currentMonthExpenseData },
    { data: financeSettings },
    { data: paidInvoicesData },
  ] = await Promise.all([
    supabase
      .from('income')
      .select('amount')
      .gte('income_date', currentMonthStart)
      .lte('income_date', currentMonthEnd),
    supabase
      .from('expenses')
      .select('id, amount')
      .gte('expense_date', currentMonthStart)
      .lte('expense_date', currentMonthEnd),
    // Soft-deleted expense markers and invoice markup metadata (fallback store)
    supabase
      .from('website_settings')
      .select('key, value')
      .or('key.like.deleted_expense_%,key.like.invoice_markup_%'),
    // Fully paid invoices for turnover & markup — only the columns used below
    supabase
      .from('invoices')
      .select('id, total_amount, quotations(markup_pct, markup_amount)')
      .eq('status', 'paid')
      .or(notDeleted),
  ]);

  const deletedExpenseKeys = new Set<string>();
  const invoiceMarkupMap = new Map<string, { markup_pct?: number; markup_amount?: number }>();
  for (const s of (financeSettings ?? []) as { key: string; value: any }[]) {
    if (s.key.startsWith('deleted_expense_')) {
      deletedExpenseKeys.add(s.key.replace('deleted_expense_', ''));
    } else if (s.key.startsWith('invoice_markup_')) {
      invoiceMarkupMap.set(s.key.replace('invoice_markup_', ''), s.value);
    }
  }

  const paidInvoicesList = paidInvoicesData ?? [];

  // Calculate turnover and markup metrics
  let totalMarkupAmount = 0;
  const markupCountsByPct: Record<string, number> = {};
  let totalMarkupPctSum = 0;
  let invoicesWithMarkupCount = 0;

  for (const inv of paidInvoicesList as any[]) {
    const invTotal = Number(inv.total_amount || 0);
    const q = (Array.isArray(inv.quotations) ? inv.quotations[0] : inv.quotations) as any;
    const meta = invoiceMarkupMap.get(inv.id);

    const markupPct = Number(meta?.markup_pct ?? q?.markup_pct ?? 15);
    const defaultMarkupAmt = Math.round((invTotal / 1.05) * (markupPct / (100 + markupPct)));
    const markupAmt = Number(meta?.markup_amount ?? q?.markup_amount ?? defaultMarkupAmt);

    totalMarkupAmount += markupAmt;
    if (markupPct > 0) {
      const pctKey = `${markupPct}%`;
      markupCountsByPct[pctKey] = (markupCountsByPct[pctKey] || 0) + 1;
      totalMarkupPctSum += markupPct;
      invoicesWithMarkupCount++;
    }
  }

  const avgMarkupPct = invoicesWithMarkupCount > 0 ? Math.round(totalMarkupPctSum / invoicesWithMarkupCount) : 15;
  const paidInvoicesCount = paidInvoicesList.length;

  // Format markup % distribution summary e.g. "3 × 15%, 1 × 20%"
  const markupPctSummary = Object.entries(markupCountsByPct)
    .sort((a, b) => b[1] - a[1])
    .map(([pct, count]) => `${count} × ${pct}`)
    .join(', ');

  // Compute Income, Turnover & Expense Totals
  const totalIncome = (currentMonthIncomeData ?? []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const turnoverDisplay = totalMarkupAmount > 0 ? totalMarkupAmount : totalIncome;
  const totalExpenses = (currentMonthExpenseData ?? [])
    .filter((item: any) => item.is_deleted !== true && !deletedExpenseKeys.has(item.id))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
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

      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Turnover Card (Total Invoices Markup Price) */}
        <Link
          href="/travinco_dashboard/invoices?status=paid"
          className="card-hover group relative overflow-hidden p-6 transition-all border-emerald-100/70 bg-gradient-to-br from-white via-white to-emerald-50/30"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                Turnover
              </span>
              <p className="mt-3 text-3xl font-bold tracking-tight text-ink-900">
                {formatCurrency(turnoverDisplay)}
              </p>
              <p className="mt-1 text-xs text-ink-500">
                Total invoices markup price from {paidInvoicesCount} fully paid {paidInvoicesCount === 1 ? 'invoice' : 'invoices'}
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-inner">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>

          {/* Markup % and Count Breakdown */}
          <div className="mt-4 rounded-xl bg-emerald-50/90 border border-emerald-100 p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-ink-600">
              <span className="text-emerald-900 font-semibold">Total Markup Count:</span>
              <span className="font-semibold text-ink-900">
                {paidInvoicesCount} paid {paidInvoicesCount === 1 ? 'invoice' : 'invoices'}
                {invoicesWithMarkupCount > 0 && ` (avg ${avgMarkupPct}%)`}
              </span>
            </div>
            {markupPctSummary ? (
              <div className="pt-1.5 border-t border-emerald-100 flex items-center justify-between text-[11px] text-emerald-800 font-medium">
                <span>Markup % Breakdown:</span>
                <span className="rounded bg-white/90 px-1.5 py-0.5 text-emerald-900 shadow-2xs font-semibold">
                  {markupPctSummary}
                </span>
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-emerald-100/60 pt-3 text-xs text-emerald-700 font-medium">
            <span>View paid invoices</span>
            <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
        </Link>

        {/* Current Month Expense Card */}
        <Link
          href="/travinco_dashboard/expenses"
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
  );
}

/* ------------------------------------------------------------------ */
/* 3. Top selling packages                                             */
/* ------------------------------------------------------------------ */

export async function TopSellingPackagesSection() {
  const supabase = await createClient();

  const [{ data: candidatePackages }, { data: deletedPackageSettings }] = await Promise.all([
    supabase
      .from('travel_packages')
      .select('id, title, slug, category, duration_days, duration_nights, base_price, cover_image_url, seats_booked, status, is_deleted')
      .or(notDeleted)
      .neq('status', 'archived')
      .order('seats_booked', { ascending: false })
      .limit(50),
    supabase.from('website_settings').select('key').like('key', 'deleted_package_%'),
  ]);

  const deletedPackageKeys = new Set(
    (deletedPackageSettings ?? []).map((s: { key: string }) => s.key.replace('deleted_package_', ''))
  );
  const packages = (candidatePackages ?? []).filter(
    (pkg: any) => pkg && pkg.is_deleted !== true && !deletedPackageKeys.has(pkg.id)
  );

  // Only bookings for the candidate packages are needed (previously every
  // booking in the system was downloaded on each dashboard load).
  const packageIds = packages.map((p: any) => p.id as string);
  const { data: bookings } = packageIds.length
    ? await supabase
        .from('bookings')
        .select('package_id, total_amount')
        .in('package_id', packageIds)
        .neq('booking_status', 'cancelled')
    : { data: [] as { package_id: string | null; total_amount: number | null }[] };

  const bookingsByPackage = new Map<string, { count: number; revenue: number }>();
  (bookings ?? []).forEach((b: any) => {
    if (!b.package_id) return;
    const existing = bookingsByPackage.get(b.package_id) || { count: 0, revenue: 0 };
    existing.count += 1;
    existing.revenue += Number(b.total_amount || 0);
    bookingsByPackage.set(b.package_id, existing);
  });

  // Sort top selling packages: by total bookings descending, then by revenue or seats booked
  const topSellingPackages: PackagePerformance[] = packages
    .map((pkg: any) => {
      const bookingStats = bookingsByPackage.get(pkg.id) || { count: 0, revenue: 0 };
      return {
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
      };
    })
    .sort((a: PackagePerformance, b: PackagePerformance) => {
      if (b.totalBookings !== a.totalBookings) {
        return b.totalBookings - a.totalBookings;
      }
      if (b.totalRevenue !== a.totalRevenue) {
        return b.totalRevenue - a.totalRevenue;
      }
      return b.seats_booked - a.seats_booked;
    })
    .slice(0, 3);

  return (
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
          href="/travinco_dashboard/packages"
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
          <Link href="/travinco_dashboard/packages/new" className="btn-primary mt-4 inline-flex text-xs">
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
                      <Image
                        src={pkg.cover_image_url}
                        alt={pkg.title}
                        fill
                        className="object-cover"
                        sizes="80px"
                        unoptimized
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
                        href={`/travinco_dashboard/packages/${pkg.id}`}
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
                    href={`/travinco_dashboard/packages/${pkg.id}`}
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
  );
}

/* ------------------------------------------------------------------ */
/* 4. Recent enquiries                                                 */
/* ------------------------------------------------------------------ */

export async function RecentEnquiriesSection() {
  const supabase = await createClient();
  const { data: recentEnquiries } = await supabase
    .from('enquiries')
    .select('id, enquiry_number, customer_name, status, created_at, destination')
    .or(notDeleted)
    .order('created_at', { ascending: false })
    .limit(5);

  const visibleRecentEnquiries = (recentEnquiries ?? []) as {
    id: string;
    enquiry_number: string;
    customer_name: string;
    status: string;
    created_at: string;
    destination: string | null;
  }[];

  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-800">Recent enquiries</h2>
          <span className="badge bg-ink-100 text-ink-600 text-[10px]">Latest</span>
        </div>
        <Link href="/travinco_dashboard/enquiries" className="text-xs font-medium text-brand-600 hover:underline">
          View all enquiries →
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
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
            {visibleRecentEnquiries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-ink-400">
                  No enquiries recorded yet.
                </td>
              </tr>
            )}
            {visibleRecentEnquiries.map((e) => (
              <tr key={e.id} className="border-b border-ink-50 last:border-0 hover:bg-sand-50/40 transition-colors">
                <td className="px-5 py-3 font-medium text-ink-700">
                  <Link href={`/travinco_dashboard/enquiries/${e.id}`} className="text-brand-700 hover:underline font-semibold">
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
  );
}

/* ------------------------------------------------------------------ */
/* Skeletons                                                           */
/* ------------------------------------------------------------------ */

export function SectionSkeleton({ variant }: { variant: 'cards4' | 'cards2' | 'list' }) {
  if (variant === 'cards4' || variant === 'cards2') {
    const n = variant === 'cards4' ? 4 : 2;
    return (
      <div>
        <div className="mb-3 h-3 w-32 rounded bg-ink-100 animate-pulse" />
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${n === 4 ? 'lg:grid-cols-4' : ''}`}>
          {Array.from({ length: n }).map((_, i) => (
            <div key={i} className={`card ${n === 4 ? 'h-[122px]' : 'h-[220px]'} p-5 animate-pulse`}>
              <div className="h-3 w-24 rounded bg-ink-100" />
              <div className="mt-4 h-7 w-20 rounded bg-ink-200/60" />
              <div className="mt-3 h-3 w-32 rounded bg-ink-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-ink-100 px-6 py-4">
        <div className="h-4 w-44 rounded bg-ink-200/60 animate-pulse" />
      </div>
      <div className="divide-y divide-ink-100">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-5 animate-pulse">
            <div className="h-10 w-14 rounded-lg bg-ink-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-1/3 rounded bg-ink-200/60" />
              <div className="h-3 w-1/4 rounded bg-ink-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
