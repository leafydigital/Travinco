import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { requireProfile, assertModulePermission, checkModulePermission } from '@/lib/supabase/auth-helpers';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate } from '@/lib/utils/format';
import Link from 'next/link';
import { Search, ArrowLeft, RotateCcw, Calendar, AlertCircle } from 'lucide-react';
import { EnquiryRowActions } from './enquiry-row-actions';
import { FollowupDateCell } from './followup-date-cell';
import { EnquiryPagination } from './enquiry-pagination';
import { AutoRefresh } from '@/components/admin/auto-refresh';

const statusFilterOptions = [
  { value: 'new', label: 'Pending' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'quotation_sent', label: 'Quotations Sent' },
  { value: 'booked', label: 'Booked' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'lost', label: 'Not Interested' },
];

const priorityFilterOptions = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

function buildHref(
  sp: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>
) {
  const merged = { ...sp, ...overrides };
  const params = new URLSearchParams();
  Object.entries(merged).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  return `?${params.toString()}`;
}

function EnquiriesTableSkeleton() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <th className="px-5 py-3">Enquiry #</th>
            <th className="px-5 py-3">Customer</th>
            <th className="px-5 py-3">Destination / Travel</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Priority</th>
            <th className="px-5 py-3">Follow-up</th>
            <th className="px-5 py-3">Assigned</th>
            <th className="px-5 py-3">Date</th>
            <th className="px-5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-50">
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i} className="animate-pulse">
              <td className="px-5 py-3.5"><div className="h-4 w-24 rounded bg-ink-200/70" /></td>
              <td className="px-5 py-3.5">
                <div className="h-4 w-28 rounded bg-ink-200/70 mb-1.5" />
                <div className="h-3 w-20 rounded bg-ink-100" />
              </td>
              <td className="px-5 py-3.5"><div className="h-4 w-24 rounded bg-ink-100" /></td>
              <td className="px-5 py-3.5"><div className="h-6 w-16 rounded-full bg-ink-100" /></td>
              <td className="px-5 py-3.5"><div className="h-6 w-16 rounded-full bg-ink-100" /></td>
              <td className="px-5 py-3.5"><div className="h-6 w-24 rounded-lg bg-ink-100" /></td>
              <td className="px-5 py-3.5"><div className="h-4 w-20 rounded bg-ink-100" /></td>
              <td className="px-5 py-3.5"><div className="h-4 w-20 rounded bg-ink-100" /></td>
              <td className="px-5 py-3.5 text-right"><div className="h-8 w-8 rounded-lg bg-ink-100 ml-auto" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function EnquiriesTableContent({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; priority?: string; view?: string; page?: string; limit?: string };
}) {
  const profile = await requireProfile();
  await assertModulePermission(profile, 'enquiries', 'view');
  const supabase = await createClient();

  const pageSize = Math.max(1, Number(searchParams.limit ?? 10));
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const today = new Date().toISOString().slice(0, 10);

  let query = supabase
    .from('enquiries')
    .select(
      'id, enquiry_number, customer_name, phone, email, destination, travel_date, status, priority, source, next_followup_date, created_at, is_deleted, assigned_staff',
      { count: 'exact' }
    )
    .or('is_deleted.is.null,is_deleted.eq.false')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (searchParams.q?.trim()) {
    const q = searchParams.q.trim();
    query = query.or(
      `customer_name.ilike.%${q}%,phone.ilike.%${q}%,enquiry_number.ilike.%${q}%,email.ilike.%${q}%`
    );
  }

  if (searchParams.status) {
    let s = searchParams.status;
    if (s === 'pending') s = 'new';
    if (s === 'not_interested') s = 'lost';
    if (s === 'booked') {
      query = query.or('status.eq.booked,status.eq.confirmed');
    } else {
      query = query.eq('status', s);
    }
  }

  if (searchParams.priority) {
    query = query.eq('priority', searchParams.priority);
  }

  if (searchParams.view === 'followup_today') {
    query = query.eq('next_followup_date', today);
  } else if (searchParams.view === 'overdue') {
    query = query
      .lt('next_followup_date', today)
      .not('status', 'in', '("confirmed","booked","lost","closed")');
  }

  const [{ data: enquiries, count, error }, { data: staffList }] = await Promise.all([
    query,
    supabase.from('profiles').select('id, full_name'),
  ]);

  if (error) {
    console.error('Error fetching enquiries table data:', error.message, error.details);
  }

  const staffMap = new Map((staffList ?? []).map((s) => [s.id, s.full_name]));
  const visibleEnquiries = (enquiries ?? []).filter((e: any) => e.is_deleted !== true);

  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
  const canEdit = isAdmin || (await checkModulePermission(profile, 'enquiries', 'edit')).allowed;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="px-5 py-3">Enquiry #</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Destination / Travel</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Priority</th>
              <th className="px-5 py-3">Follow-up</th>
              <th className="px-5 py-3">Assigned</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleEnquiries.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-ink-400">
                  <AlertCircle className="mx-auto mb-2 h-7 w-7 text-ink-300" />
                  <p className="font-medium text-ink-700">No enquiries found</p>
                  <p className="text-xs text-ink-400 mt-0.5">Try resetting filters or search query</p>
                </td>
              </tr>
            )}
            {visibleEnquiries.map((e) => {
              const isTodayTravel = e.travel_date === today;
              return (
                <tr key={e.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/travinco_dashboard/enquiries/${e.id}`}
                      className="font-medium text-ink-800 hover:text-brand-700 hover:underline"
                    >
                      {e.enquiry_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-ink-800">{e.customer_name}</p>
                    <p className="text-xs text-ink-400">{e.phone}</p>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-ink-700">{e.destination || '—'}</p>
                    {e.travel_date && (
                      <p className={`text-xs ${isTodayTravel ? 'font-semibold text-rose-600' : 'text-ink-400'}`}>
                        {formatDate(e.travel_date)}
                        {isTodayTravel && ' (Today)'}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={e.priority} />
                  </td>
                  <td className="px-5 py-3">
                    <FollowupDateCell
                      enquiryId={e.id}
                      customerName={e.customer_name}
                      enquiryNumber={e.enquiry_number}
                      currentDate={e.next_followup_date}
                      status={e.status}
                    />
                  </td>
                  <td className="px-5 py-3 text-ink-500">
                    {e.assigned_staff ? staffMap.get(e.assigned_staff) ?? 'Staff' : 'Unassigned'}
                  </td>
                  <td className="px-5 py-3 text-ink-500">{formatDate(e.created_at)}</td>
                  <td className="px-5 py-3 text-right">
                    <EnquiryRowActions
                      id={e.id}
                      customerName={e.customer_name}
                      isAdmin={isAdmin}
                      canEdit={canEdit}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <EnquiryPagination
        totalCount={count ?? 0}
        currentPage={page}
        pageSize={pageSize}
      />
    </>
  );
}

export default async function AdminEnquiriesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; priority?: string; view?: string; page?: string; limit?: string };
}) {
  const profile = await requireProfile();
  await assertModulePermission(profile, 'enquiries', 'view');
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);

  // Tab count queries for rapid user overview (excludes soft-deleted enquiries)
  const [{ count: allCount }, { count: todayCount }, { count: overdueCount }] = await Promise.all([
    supabase
      .from('enquiries')
      .select('*', { count: 'exact', head: true })
      .or('is_deleted.is.null,is_deleted.eq.false'),
    supabase
      .from('enquiries')
      .select('*', { count: 'exact', head: true })
      .or('is_deleted.is.null,is_deleted.eq.false')
      .eq('next_followup_date', today),
    supabase
      .from('enquiries')
      .select('*', { count: 'exact', head: true })
      .or('is_deleted.is.null,is_deleted.eq.false')
      .lt('next_followup_date', today)
      .not('status', 'in', '("confirmed","booked","lost","closed")'),
  ]);

  const hasFilters = Boolean(searchParams.q || searchParams.status || searchParams.priority);
  const suspKey = `${searchParams.q ?? ''}-${searchParams.status ?? ''}-${searchParams.priority ?? ''}-${searchParams.view ?? ''}-${searchParams.page ?? '1'}-${searchParams.limit ?? '10'}`;

  return (
    <div className="space-y-5">
      <AutoRefresh intervalMs={30000} />

      {/* 1. Header Structure */}
      <div>
        <Link
          href="/travinco_dashboard"
          className="mb-1 flex items-center gap-1 text-sm text-ink-500 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <h1 className="text-xl font-semibold text-ink-900">Enquiries</h1>
        <p className="text-sm text-ink-500">
          Track, prioritize, and follow up with customer travel enquiries and quote requests
        </p>
      </div>

      {/* 2. View Tabs (All, Follow-up Today, Overdue Follow-up) */}
      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/travinco_dashboard/enquiries"
          className={`btn-outline flex items-center gap-2 ${
            !searchParams.view ? 'bg-brand-50 border-brand-300 text-brand-700 font-medium' : ''
          }`}
        >
          <span>All</span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-xs ${
              !searchParams.view ? 'bg-brand-200/80 text-brand-800' : 'bg-ink-100 text-ink-600'
            }`}
          >
            {allCount ?? 0}
          </span>
        </Link>

        <Link
          href={buildHref(searchParams, { view: 'followup_today', page: undefined })}
          className={`btn-outline flex items-center gap-2 ${
            searchParams.view === 'followup_today'
              ? 'bg-amber-50 border-amber-300 text-amber-800 font-medium'
              : ''
          }`}
        >
          <span>Follow-up Today</span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-xs ${
              searchParams.view === 'followup_today'
                ? 'bg-amber-200/80 text-amber-900 font-semibold'
                : 'bg-ink-100 text-ink-600'
            }`}
          >
            {todayCount ?? 0}
          </span>
        </Link>

        <Link
          href={buildHref(searchParams, { view: 'overdue', page: undefined })}
          className={`btn-outline flex items-center gap-2 ${
            searchParams.view === 'overdue'
              ? 'bg-red-50 border-red-300 text-red-700 font-medium'
              : ''
          }`}
        >
          <span>Overdue Follow-up</span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-xs ${
              searchParams.view === 'overdue'
                ? 'bg-red-200 text-red-800 font-semibold'
                : (overdueCount ?? 0) > 0
                ? 'bg-red-100 text-red-700 font-semibold'
                : 'bg-ink-100 text-ink-600'
            }`}
          >
            {overdueCount ?? 0}
          </span>
        </Link>
      </div>

      {/* 3. Search & Filter Bar */}
      <form className="flex flex-wrap items-center gap-3" method="get">
        {searchParams.view && <input type="hidden" name="view" value={searchParams.view} />}
        {searchParams.limit && <input type="hidden" name="limit" value={searchParams.limit} />}
        <div className="relative flex-1 min-w-[200px] sm:min-w-[220px] w-full sm:w-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            name="q"
            defaultValue={searchParams.q}
            placeholder="Search name, phone, enquiry #, email…"
            className="input pl-9 w-full"
          />
        </div>

        <select name="status" defaultValue={searchParams.status ?? ''} className="input w-full sm:w-auto">
          <option value="">All statuses</option>
          {statusFilterOptions.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <select name="priority" defaultValue={searchParams.priority ?? ''} className="input w-full sm:w-auto">
          <option value="">All priorities</option>
          {priorityFilterOptions.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        <button type="submit" className="btn-primary w-full sm:w-auto">
          Filter
        </button>

        {hasFilters && (
          <Link
            href={buildHref(searchParams, { q: undefined, status: undefined, priority: undefined, page: undefined })}
            className="btn-outline flex items-center gap-1 text-ink-600"
            title="Clear search and filters"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Clear
          </Link>
        )}
      </form>

      {/* 4. Table Card */}
      <div className="card overflow-hidden">
        <Suspense key={suspKey} fallback={<EnquiriesTableSkeleton />}>
          <EnquiriesTableContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
