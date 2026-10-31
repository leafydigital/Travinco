import { FilterBar } from '@/components/admin/filter-bar';
import { Suspense, cache } from 'react';
import { requireProfile, assertModulePermission, checkModulePermission } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Search, ArrowLeft, RotateCcw } from 'lucide-react';
import { AutoRefresh } from '@/components/admin/auto-refresh';
import { getEnquiriesTableList, getEnquiryTabCounts } from './actions';
import { EnquiryClearDataButton } from './enquiry-clear-data-button';
import { DateRangeFilter } from './date-range-filter';
import { ENQUIRY_STATUS_OPTIONS } from '@/lib/enquiry-status';
import { EnquiriesTable } from './enquiries-table';
import { UploadExcelButton } from './upload-excel-button';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type EnquiriesSearchParams = {
  q?: string;
  status?: string;
  priority?: string;
  view?: string;
  assigned?: string;
  from?: string;
  to?: string;
  page?: string;
  limit?: string;
};

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

// Per-request memo for the tab badge counts
const getTabCountsCached = cache(() => getEnquiryTabCounts());

// Active staff an admin can assign enquiries to (filter dropdown + bulk assign)
const getActiveStaffCached = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name');
  return (data ?? []) as { id: string; full_name: string }[];
});

function TabCountersSkeleton() {
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <div className="h-9 w-20 rounded-lg bg-ink-100 animate-pulse" />
      <div className="h-9 w-36 rounded-lg bg-ink-100 animate-pulse" />
      <div className="h-9 w-40 rounded-lg bg-ink-100 animate-pulse" />
    </div>
  );
}

async function EnquiryTabBadges({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const counts = await getTabCountsCached();

  return (
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
          {counts.allCount}
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
          {counts.todayCount}
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
              : counts.overdueCount > 0
              ? 'bg-red-100 text-red-700 font-semibold'
              : 'bg-ink-100 text-ink-600'
          }`}
        >
          {counts.overdueCount}
        </span>
      </Link>
    </div>
  );
}

function EnquiriesTableSkeleton() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <th className="w-10 py-3 pl-5 pr-1" />
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
              <td className="py-3.5 pl-5 pr-1"><div className="h-4 w-4 rounded bg-ink-100" /></td>
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
  isAdmin,
  canEdit,
}: {
  searchParams: EnquiriesSearchParams;
  isAdmin: boolean;
  canEdit: boolean;
}) {
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.limit ?? 20) || 20));
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);
  const today = new Date().toISOString().slice(0, 10);

  const [result, staff] = await Promise.all([
    getEnquiriesTableList({
      page,
      pageSize,
      q: searchParams.q ?? '',
      status: searchParams.status ?? '',
      priority: searchParams.priority ?? '',
      view: searchParams.view ?? '',
      assigned: searchParams.assigned ?? '',
      from: searchParams.from ?? '',
      to: searchParams.to ?? '',
    }),
    isAdmin ? getActiveStaffCached() : Promise.resolve([]),
  ]);

  return (
    <EnquiriesTable
      enquiries={result.enquiries}
      totalCount={result.totalCount}
      currentPage={result.page}
      pageSize={result.pageSize}
      isAdmin={isAdmin}
      canEdit={canEdit}
      staff={staff}
      today={today}
    />
  );
}

/** Admin-only "Assigned to" filter. */
async function AssignedFilter({ value }: { value: string }) {
  const staff = await getActiveStaffCached();
  return (
    <select name="assigned" defaultValue={value} className="input w-full sm:w-auto">
      <option value="">Everyone</option>
      <option value="unassigned">Unassigned</option>
      {staff.map((s) => (
        <option key={s.id} value={s.id}>
          {s.full_name}
        </option>
      ))}
    </select>
  );
}

export default async function AdminEnquiriesPage({
  searchParams,
}: {
  searchParams: EnquiriesSearchParams;
}) {
  const profile = await requireProfile();
  await assertModulePermission(profile, 'enquiries', 'view');

  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
  const canEdit = isAdmin || (await checkModulePermission(profile, 'enquiries', 'edit')).allowed;

  const hasFilters = Boolean(
    searchParams.q ||
      searchParams.status ||
      searchParams.priority ||
      searchParams.from ||
      searchParams.to ||
      (isAdmin && searchParams.assigned)
  );
  const suspKey = `${searchParams.q ?? ''}-${searchParams.status ?? ''}-${searchParams.priority ?? ''}-${searchParams.view ?? ''}-${searchParams.assigned ?? ''}-${searchParams.from ?? ''}-${searchParams.to ?? ''}-${searchParams.page ?? '1'}-${searchParams.limit ?? '20'}`;

  return (
    <div className="space-y-5">
      <AutoRefresh intervalMs={30000} />

      {/* 1. Instant Header Structure (<50ms) */}
      <div>
        <Link
          href="/travinco_dashboard"
          className="mb-1 flex items-center gap-1 text-sm text-ink-500 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-ink-900">Enquiries</h1>
            <p className="text-sm text-ink-500">
              {isAdmin
                ? 'Website, contact form and uploaded enquiries in one place. Select rows to assign them to employees.'
                : 'Enquiries assigned to you'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {isAdmin && (
              <EnquiryClearDataButton
                key={`${searchParams.from ?? ''}-${searchParams.to ?? ''}`}
                initialFrom={searchParams.from ?? ''}
                initialTo={searchParams.to ?? ''}
              />
            )}
            {canEdit && <UploadExcelButton isAdmin={isAdmin} />}
          </div>
        </div>
      </div>

      {/* 2. Streaming View Tabs (All, Follow-up Today, Overdue Follow-up) */}
      <Suspense fallback={<TabCountersSkeleton />}>
        <EnquiryTabBadges searchParams={searchParams} />
      </Suspense>

      {/* 3. Instant Search & Filter Bar */}
      <FilterBar>
        {searchParams.view && <input type="hidden" name="view" value={searchParams.view} />}
        {searchParams.limit && <input type="hidden" name="limit" value={searchParams.limit} />}
        <div className="relative flex-1 min-w-[200px] sm:min-w-[220px] w-full sm:w-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            name="q"
            defaultValue={searchParams.q}
            placeholder="Search name, phone, enquiry #, email, package…"
            className="input pl-9 w-full"
          />
        </div>

        <select name="status" defaultValue={searchParams.status ?? ''} className="input w-full sm:w-auto">
          <option value="">All statuses</option>
          {ENQUIRY_STATUS_OPTIONS.map((s) => (
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

        <DateRangeFilter
          key={`${searchParams.from ?? ''}-${searchParams.to ?? ''}`}
          initialFrom={searchParams.from ?? ''}
          initialTo={searchParams.to ?? ''}
        />

        {isAdmin && (
          <Suspense
            fallback={
              <select disabled className="input w-full sm:w-auto">
                <option>Everyone</option>
              </select>
            }
          >
            <AssignedFilter value={searchParams.assigned ?? ''} />
          </Suspense>
        )}


        {hasFilters && (
          <Link
            href={buildHref(searchParams, { q: undefined, status: undefined, priority: undefined, assigned: undefined, from: undefined, to: undefined, page: undefined })}
            className="btn-outline flex items-center gap-1 text-ink-600"
            title="Clear search and filters"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Clear
          </Link>
        )}
      </FilterBar>

      {/* 4. Fast Streaming Table with Skeleton */}
      <div className="card overflow-hidden">
        <Suspense key={suspKey} fallback={<EnquiriesTableSkeleton />}>
          <EnquiriesTableContent
            searchParams={searchParams}
            isAdmin={isAdmin}
            canEdit={canEdit}
          />
        </Suspense>
      </div>
    </div>
  );
}
