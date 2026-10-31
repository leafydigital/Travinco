import { FilterBar } from '@/components/admin/filter-bar';
import { Suspense } from 'react';
import { requireProfile, assertModulePermission } from '@/lib/supabase/auth-helpers';
import Link from 'next/link';
import { Search, Plus, ArrowLeft } from 'lucide-react';
import { CustomerRowActions } from './customer-row-actions';
import { CustomerStatusBadge } from './customer-status-badge';
import { StatusFilterSelect } from './status-filter-select';
import { getCustomersTableList } from './actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PAGE_SIZE = 20;

function buildHref(sp: Record<string, string | undefined>, overrides: Record<string, string | undefined>) {
  const merged = { ...sp, ...overrides };
  const params = new URLSearchParams();
  Object.entries(merged).forEach(([k, v]) => v && params.set(k, v));
  return `?${params.toString()}`;
}

function CustomersTableSkeleton() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400 bg-sand-50/40">
            <th className="px-5 py-3 font-semibold">Customer</th>
            <th className="px-5 py-3 font-semibold">Phone</th>
            <th className="px-5 py-3 font-semibold">Email</th>
            <th className="px-5 py-3 font-semibold">City</th>
            <th className="px-5 py-3 font-semibold">Source</th>
            <th className="px-5 py-3 font-semibold">Status</th>
            <th className="px-5 py-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-50">
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i} className="animate-pulse">
              <td className="px-5 py-3.5"><div className="h-4 w-32 rounded bg-ink-200/70" /></td>
              <td className="px-5 py-3.5"><div className="h-4 w-24 rounded bg-ink-100" /></td>
              <td className="px-5 py-3.5"><div className="h-4 w-36 rounded bg-ink-100" /></td>
              <td className="px-5 py-3.5"><div className="h-4 w-20 rounded bg-ink-100" /></td>
              <td className="px-5 py-3.5"><div className="h-4 w-16 rounded bg-ink-100" /></td>
              <td className="px-5 py-3.5"><div className="h-6 w-16 rounded-full bg-ink-100" /></td>
              <td className="px-5 py-3.5 text-right"><div className="h-7 w-20 rounded-lg bg-ink-100 ml-auto" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function CustomersTableContent({
  searchParams,
  isAdmin,
  canEdit,
}: {
  searchParams: { q?: string; page?: string; status?: string };
  isAdmin: boolean;
  canEdit: boolean;
}) {
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const q = searchParams.q ?? '';

  const result = await getCustomersTableList({
    page,
    pageSize: PAGE_SIZE,
    q,
    status: searchParams.status ?? '',
  });

  const { customers, totalCount, totalPages } = result;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400 bg-sand-50/40">
              <th className="px-5 py-3 font-semibold">Customer</th>
              <th className="px-5 py-3 font-semibold">Phone</th>
              <th className="px-5 py-3 font-semibold">Email</th>
              <th className="px-5 py-3 font-semibold">City</th>
              <th className="px-5 py-3 font-semibold">Source</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-50">
            {customers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-ink-400">
                  No customers found.
                </td>
              </tr>
            )}
            {customers.map((c) => (
              <tr
                key={c.id}
                className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50"
              >
                {/* 1. Customer */}
                <td className="px-5 py-3">
                  <span className="font-medium text-ink-900">
                    {c.full_name}
                  </span>
                </td>

                {/* 2. Phone */}
                <td className="px-5 py-3 text-ink-600">{c.phone || '—'}</td>

                {/* 3. Email */}
                <td className="px-5 py-3 text-ink-500">{c.email || '—'}</td>

                {/* 4. City */}
                <td className="px-5 py-3 text-ink-500">{c.city || '—'}</td>

                {/* 5. Source */}
                <td className="px-5 py-3 text-ink-500 capitalize">{c.source?.replace('_', ' ') || '—'}</td>

                {/* 6. Status */}
                <td className="px-5 py-3">
                  <CustomerStatusBadge customerId={c.id} initialActive={c.is_active} isDeleted={c.is_deleted} />
                </td>

                {/* 7. Actions */}
                <td className="px-5 py-3 text-right">
                  <CustomerRowActions
                    customer={c}
                    isActive={c.is_active}
                    canEdit={canEdit}
                    isAdmin={isAdmin}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3 text-sm text-ink-500">
          <span>Page {page} of {totalPages} ({totalCount} total)</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildHref(searchParams, { page: String(page - 1) })} className="btn-outline px-3 py-1.5 text-xs">
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildHref(searchParams, { page: String(page + 1) })} className="btn-outline px-3 py-1.5 text-xs">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string; status?: string };
}) {
  const profile = await requireProfile();
  await assertModulePermission(profile, 'customers', 'view');

  const isAdmin = ['admin', 'super_admin'].includes(profile.role);
  const canEdit = isAdmin || profile.role === 'sales_staff';

  const suspKey = `${searchParams.q ?? ''}-${searchParams.status ?? ''}-${searchParams.page ?? '1'}`;

  return (
    <div className="space-y-5">
      {/* 1. Header Structure (Renders Instantly <50ms) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/travinco_dashboard"
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-brand-700 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
          </Link>
          <h1 className="text-xl font-semibold text-ink-900">Customers</h1>
          <p className="text-sm text-ink-500">Directory of travel customers and leads</p>
        </div>
        <Link href="/travinco_dashboard/customers/new" prefetch={true} className="btn-primary">
          <Plus className="h-4 w-4" /> New customer
        </Link>
      </div>

      {/* 2. Filter Form Structure (Renders Instantly) */}
      <FilterBar>
        <div className="relative flex-1 min-w-[200px] sm:min-w-[220px] max-w-md w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            name="q"
            defaultValue={searchParams.q}
            placeholder="Search by name, phone, or email…"
            className="input pl-9 w-full"
          />
        </div>
        <StatusFilterSelect defaultValue={searchParams.status} />
      </FilterBar>

      {/* 3. Table Card (Header loads immediately, rows stream via Suspense) */}
      <div className="card overflow-hidden">
        <Suspense key={suspKey} fallback={<CustomersTableSkeleton />}>
          <CustomersTableContent
            searchParams={searchParams}
            isAdmin={isAdmin}
            canEdit={canEdit}
          />
        </Suspense>
      </div>
    </div>
  );
}
