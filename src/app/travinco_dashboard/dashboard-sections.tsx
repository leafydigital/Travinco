import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { formatCurrency } from '@/lib/utils/format';
import { normalizeEnquiryStatus } from '@/lib/enquiry-status';
import {
  Users,
  FileClock,
  PhoneCall,
  BadgeCheck,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';
import { TopPackagesChart, type PackageStat } from './top-packages-chart';

/**
 * Dashboard sections. Each one fetches only its own data for the selected month
 * and is rendered inside its own <Suspense> boundary on the dashboard page.
 */

const notDeleted = 'is_deleted.is.null,is_deleted.eq.false';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface MonthInfo {
  /** YYYY-MM */
  key: string;
  /** YYYY-MM-DD bounds (inclusive) */
  start: string;
  end: string;
  /** Timestamp bounds in India time, for created_at columns */
  startTs: string;
  endTs: string;
  name: string;
  isCurrent: boolean;
}

/**
 * The month to show (India time). `month` is ?month=YYYY-MM; anything missing,
 * malformed or in the future falls back to the current month.
 */
export function monthInfo(month?: string | null): MonthInfo {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const nowYear = Number(parts.find((p) => p.type === 'year')?.value);
  const nowMonth = Number(parts.find((p) => p.type === 'month')?.value);

  let year = nowYear;
  let mon = nowMonth;
  const m = /^(\d{4})-(\d{2})$/.exec(month ?? '');
  if (m) {
    const y = Number(m[1]);
    const mm = Number(m[2]);
    const inRange = y >= 2000 && mm >= 1 && mm <= 12;
    const notFuture = y < nowYear || (y === nowYear && mm <= nowMonth);
    if (inRange && notFuture) {
      year = y;
      mon = mm;
    }
  }

  const mm = String(mon).padStart(2, '0');
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const start = `${year}-${mm}-01`;
  const end = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;
  return {
    key: `${year}-${mm}`,
    start,
    end,
    startTs: `${start}T00:00:00+05:30`,
    endTs: `${end}T23:59:59.999+05:30`,
    name: `${MONTH_NAMES[mon - 1]} ${year}`,
    isCurrent: year === nowYear && mon === nowMonth,
  };
}

/** Employees only count the enquiries assigned to them (same rule as the Enquiries page). */
async function scopedEnquiryFilter() {
  const profile = await requireProfile();
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
  return isAdmin ? null : profile.id;
}

function isMissingColumnError(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === '42703' || /column .* does not exist|enquiry_date/i.test(error.message ?? '')));
}

/**
 * Enquiries received in the month (by Enquiry Date; created date on a database
 * without that column), with the columns asked for.
 */
async function enquiriesInMonth(month: MonthInfo, columns: string) {
  const supabase = await createClient();
  const assignedTo = await scopedEnquiryFilter();
  const PAGE = 1000;

  const load = async (byCreated: boolean) => {
    const rows: Record<string, any>[] = [];
    for (let offset = 0; offset < 20_000; offset += PAGE) {
      let q = supabase.from('enquiries').select(columns).or(notDeleted).order('id').range(offset, offset + PAGE - 1);
      q = byCreated
        ? q.gte('created_at', month.startTs).lte('created_at', month.endTs)
        : q.gte('enquiry_date', month.start).lte('enquiry_date', month.end);
      if (assignedTo) q = q.eq('assigned_staff', assignedTo);
      const { data, error } = await q;
      if (error) return { rows, error };
      rows.push(...((data ?? []) as unknown as Record<string, any>[]));
      if (!data || data.length < PAGE) break;
    }
    return { rows, error: null };
  };

  const first = await load(false);
  if (isMissingColumnError(first.error)) return (await load(true)).rows;
  if (first.error) console.error('dashboard enquiries query failed:', first.error.message);
  return first.rows;
}

/* ------------------------------------------------------------------ */
/* 1. Enquiry status cards                                             */
/* ------------------------------------------------------------------ */

const ENQUIRY_CARDS = [
  { key: 'total', label: 'Total Leads', hint: 'Enquiries received', icon: Users, status: '', tone: 'text-brand-700', chip: 'bg-brand-50 text-brand-700', bar: 'bg-brand-500' },
  { key: 'pending_quote', label: 'Pending Quote', hint: 'Quotation to prepare', icon: FileClock, status: 'pending_quote', tone: 'text-amber-700', chip: 'bg-amber-50 text-amber-600', bar: 'bg-amber-500' },
  { key: 'follow_up', label: 'Follow Up', hint: 'In conversation', icon: PhoneCall, status: 'follow_up', tone: 'text-purple-700', chip: 'bg-purple-50 text-purple-600', bar: 'bg-purple-500' },
  { key: 'converted', label: 'Converted', hint: 'Won enquiries', icon: BadgeCheck, status: 'converted', tone: 'text-emerald-700', chip: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500' },
] as const;

export async function EnquiryStatsSection({ month }: { month: MonthInfo }) {
  const rows = await enquiriesInMonth(month, 'status');
  const counts: Record<string, number> = { total: rows.length };
  for (const r of rows) {
    const s = normalizeEnquiryStatus(r.status);
    counts[s] = (counts[s] ?? 0) + 1;
  }
  const total = rows.length;

  return (
    <section aria-labelledby="enquiry-stats-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="enquiry-stats-heading" className="text-xs font-semibold uppercase tracking-wider text-ink-400">
          Enquiries · {month.name}
        </h2>
        <Link
          href={`/travinco_dashboard/enquiries?from=${month.start}&to=${month.end}`}
          className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
        >
          View enquiries →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {ENQUIRY_CARDS.map((card) => {
          const Icon = card.icon;
          const value = counts[card.key] ?? 0;
          const share = card.key !== 'total' && total > 0 ? Math.round((value / total) * 100) : null;
          const href = `/travinco_dashboard/enquiries?from=${month.start}&to=${month.end}${card.status ? `&status=${card.status}` : ''}`;
          return (
            <Link
              key={card.key}
              href={href}
              className="card-hover group relative overflow-hidden p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${card.tone}`}>{card.label}</span>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${card.chip}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-ink-900">{value}</p>
              <p className="mt-1 text-xs text-ink-500">{share !== null ? `${share}% of leads` : card.hint}</p>
              {/* Share of the month's leads */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-ink-100">
                <div className={`h-full ${card.bar}`} style={{ width: `${card.key === 'total' ? 100 : share ?? 0}%` }} />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Income & expense                                                 */
/* ------------------------------------------------------------------ */

export async function FinancialOverviewSection({ month }: { month: MonthInfo }) {
  const supabase = await createClient();

  const [{ data: expenseData }, { data: financeSettings }, { data: paidInvoices }] = await Promise.all([
    supabase.from('expenses').select('*').gte('expense_date', month.start).lte('expense_date', month.end),
    // Soft-deleted expense markers and invoice markup metadata (fallback store)
    supabase.from('website_settings').select('key, value').or('key.like.deleted_expense_%,key.like.invoice_markup_%'),
    // Income = total markup price of the fully paid invoices dated in the month
    supabase
      .from('invoices')
      .select('id, total_amount, quotations(markup_pct, markup_amount)')
      .eq('status', 'paid')
      .gte('invoice_date', month.start)
      .lte('invoice_date', month.end)
      .or(notDeleted),
  ]);

  const deletedExpenseKeys = new Set<string>();
  const invoiceMarkupMap = new Map<string, { markup_pct?: number; markup_amount?: number }>();
  for (const s of (financeSettings ?? []) as { key: string; value: any }[]) {
    if (s.key.startsWith('deleted_expense_')) deletedExpenseKeys.add(s.key.replace('deleted_expense_', ''));
    else if (s.key.startsWith('invoice_markup_')) invoiceMarkupMap.set(s.key.replace('invoice_markup_', ''), s.value);
  }

  const expenseRows = (expenseData ?? []).filter((r: any) => r.is_deleted !== true && !deletedExpenseKeys.has(r.id));
  const totalExpenses = expenseRows.reduce((sum, r: any) => sum + Number(r.amount || 0), 0);

  let markupEarned = 0;
  for (const inv of (paidInvoices ?? []) as any[]) {
    const invTotal = Number(inv.total_amount || 0);
    const q = (Array.isArray(inv.quotations) ? inv.quotations[0] : inv.quotations) as any;
    const meta = invoiceMarkupMap.get(inv.id);
    const markupPct = Number(meta?.markup_pct ?? q?.markup_pct ?? 15);
    const fallback = Math.round((invTotal / 1.05) * (markupPct / (100 + markupPct)));
    markupEarned += Number(meta?.markup_amount ?? q?.markup_amount ?? fallback);
  }
  const paidCount = (paidInvoices ?? []).length;

  return (
    <section aria-labelledby="finance-heading">
      <h2 id="finance-heading" className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
        Income &amp; Expense · {month.name}
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/travinco_dashboard/invoices?status=paid" className="card-hover group relative overflow-hidden p-5">
          <div className="flex items-start justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> Income
            </span>
            <ArrowUpRight className="h-4 w-4 text-ink-300 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-emerald-600" />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-ink-900">{formatCurrency(markupEarned)}</p>
          <p className="mt-1 text-xs text-ink-500">
            Total markup from {paidCount} fully paid invoice{paidCount === 1 ? '' : 's'}
          </p>
          <div className="absolute left-0 right-0 top-0 h-1 bg-emerald-500" />
        </Link>

        <Link href="/travinco_dashboard/expenses" className="card-hover group relative overflow-hidden p-5">
          <div className="flex items-start justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
              <TrendingDown className="h-3.5 w-3.5 text-rose-600" /> Expense
            </span>
            <ArrowUpRight className="h-4 w-4 text-ink-300 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-rose-600" />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-ink-900">{formatCurrency(totalExpenses)}</p>
          <p className="mt-1 text-xs text-ink-500">
            {expenseRows.length} voucher{expenseRows.length === 1 ? '' : 's'} recorded
          </p>
          <div className="absolute left-0 right-0 top-0 h-1 bg-rose-500" />
        </Link>

      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Top selling packages (chart)                                     */
/* ------------------------------------------------------------------ */

const TOP_PACKAGES = 8;

export async function TopSellingPackagesSection({ month }: { month: MonthInfo }) {
  const supabase = await createClient();

  const [enquiries, { data: bookings }] = await Promise.all([
    enquiriesInMonth(month, 'package_id, destination'),
    supabase
      .from('bookings')
      .select('package_id, total_amount')
      .neq('booking_status', 'cancelled')
      .gte('created_at', month.startTs)
      .lte('created_at', month.endTs),
  ]);

  const packageIds = Array.from(
    new Set([...enquiries.map((e) => e.package_id), ...(bookings ?? []).map((b: any) => b.package_id)].filter(Boolean))
  ) as string[];
  const { data: packages } = packageIds.length
    ? await supabase.from('travel_packages').select('id, title').in('id', packageIds)
    : { data: [] as { id: string; title: string }[] };
  const titles = new Map((packages ?? []).map((p: any) => [p.id as string, p.title as string]));

  // Website enquiries link a package; uploaded ones only have the package name typed in
  const stats = new Map<string, PackageStat>();
  const bump = (name: string | null | undefined, field: 'enquiries' | 'bookings', revenue = 0) => {
    const label = name?.trim();
    if (!label) return;
    const k = label.toLowerCase();
    const row = stats.get(k) ?? { name: label, enquiries: 0, bookings: 0, revenue: 0 };
    row[field] += 1;
    row.revenue += revenue;
    stats.set(k, row);
  };
  for (const e of enquiries) bump(e.package_id ? titles.get(e.package_id) : e.destination, 'enquiries');
  for (const b of (bookings ?? []) as any[]) bump(titles.get(b.package_id), 'bookings', Number(b.total_amount || 0));

  const data = Array.from(stats.values())
    .sort((a, b) => b.bookings - a.bookings || b.enquiries - a.enquiries || b.revenue - a.revenue)
    .slice(0, TOP_PACKAGES);

  return <TopPackagesChart data={data} monthName={month.name} />;
}

/* ------------------------------------------------------------------ */
/* Skeletons                                                           */
/* ------------------------------------------------------------------ */

export function SectionSkeleton({ variant }: { variant: 'cards4' | 'cards2' | 'chart' }) {
  if (variant === 'chart') {
    return (
      <div className="card overflow-hidden">
        <div className="border-b border-ink-100 px-5 py-4">
          <div className="h-4 w-44 animate-pulse rounded bg-ink-200/60" />
        </div>
        <div className="space-y-4 p-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex animate-pulse items-center gap-4">
              <div className="h-3 w-32 rounded bg-ink-100" />
              <div className="h-3 rounded bg-ink-200/60" style={{ width: `${70 - i * 9}%` }} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  const n = variant === 'cards4' ? 4 : 2;
  return (
    <div>
      <div className="mb-3 h-3 w-40 animate-pulse rounded bg-ink-100" />
      <div className={n === 4 ? 'grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4' : 'grid grid-cols-1 gap-4 sm:grid-cols-2'}>
        {Array.from({ length: n }).map((_, i) => (
          <div
            key={i}
            className={`card animate-pulse p-5 ${n === 4 ? 'h-[118px]' : 'h-[150px]'}`}
          >
            <div className="h-3 w-24 rounded bg-ink-100" />
            <div className="mt-4 h-7 w-20 rounded bg-ink-200/60" />
            <div className="mt-3 h-3 w-32 rounded bg-ink-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
