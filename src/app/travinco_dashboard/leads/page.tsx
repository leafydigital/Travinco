import { Suspense } from 'react';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { LeadsFilterBar } from './leads-filter-bar';
import { LeadsTable } from './leads-table';
import { UploadExcelButton } from './upload-excel-button';
import { getLeadsTableList } from './actions';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Leads — Travinco Admin' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  searchParams: {
    q?: string;
    status?: string;
    page?: string;
    limit?: string;
  };
}

function LeadsTableSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto min-h-[280px]">
        <table className="w-full min-w-[850px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400 bg-sand-50/40">
              <th className="w-10 px-4 py-3 font-semibold"></th>
              <th className="px-4 py-3 font-semibold">Contact Name</th>
              <th className="px-4 py-3 font-semibold">Contact Number</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Package</th>
              <th className="px-4 py-3 text-center font-semibold">Days</th>
              <th className="px-4 py-3 font-semibold">Budget</th>
              <th className="px-4 py-3 font-semibold">From Date</th>
              <th className="px-4 py-3 font-semibold">To Date</th>
              <th className="px-4 py-3 text-center font-semibold">People</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-50">
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                <td className="w-10 px-4 py-3.5"><div className="h-4 w-4 rounded bg-ink-200" /></td>
                <td className="px-4 py-3.5"><div className="h-4 w-28 rounded bg-ink-200/70" /></td>
                <td className="px-4 py-3.5"><div className="h-4 w-24 rounded bg-ink-100" /></td>
                <td className="px-4 py-3.5"><div className="h-4 w-32 rounded bg-ink-100" /></td>
                <td className="px-4 py-3.5"><div className="h-4 w-24 rounded bg-ink-100" /></td>
                <td className="px-4 py-3.5 text-center"><div className="h-4 w-8 rounded bg-ink-100 mx-auto" /></td>
                <td className="px-4 py-3.5"><div className="h-4 w-16 rounded bg-ink-100" /></td>
                <td className="px-4 py-3.5"><div className="h-4 w-20 rounded bg-ink-100" /></td>
                <td className="px-4 py-3.5"><div className="h-4 w-20 rounded bg-ink-100" /></td>
                <td className="px-4 py-3.5 text-center"><div className="h-4 w-8 rounded bg-ink-100 mx-auto" /></td>
                <td className="px-4 py-3.5"><div className="h-6 w-20 rounded-full bg-ink-100" /></td>
                <td className="px-4 py-3.5 text-right"><div className="h-6 w-14 rounded-lg bg-ink-100 ml-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function LeadsTableContent({
  searchParams,
  isAdmin,
}: {
  searchParams: PageProps['searchParams'];
  isAdmin: boolean;
}) {
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = Math.max(10, Math.min(100, Number(searchParams.limit ?? 20)));
  const q = searchParams.q ?? '';
  const status = searchParams.status ?? '';

  const result = await getLeadsTableList({
    page,
    pageSize,
    q,
    status,
  });

  return (
    <LeadsTable
      leads={result.leads}
      totalCount={result.totalCount}
      currentPage={result.page}
      pageSize={result.pageSize}
      isAdmin={isAdmin}
    />
  );
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const profile = await requireProfile();
  const isAdmin = ['admin', 'super_admin'].includes(profile.role);

  const pageSize = Math.max(10, Math.min(100, Number(searchParams.limit ?? 20)));
  const suspKey = `${searchParams.q ?? ''}-${searchParams.status ?? ''}-${searchParams.page ?? '1'}-${pageSize}`;

  return (
    <div className="space-y-5">
      {/* 1. Header Structure (Renders Instantly <50ms) */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-ink-900 tracking-tight">Leads</h1>
          <p className="mt-0.5 text-sm text-ink-500">
            Track customer enquiries, import spreadsheet records, and manage conversion pipelines
          </p>
        </div>
        <UploadExcelButton />
      </div>

      {/* 2. Instant Search, Status Dropdown Filter & Page Size Selector */}
      <LeadsFilterBar
        initialSearch={searchParams.q ?? ''}
        initialStatus={searchParams.status ?? ''}
        initialLimit={pageSize}
      />

      {/* 3. Streaming Table with Skeleton */}
      <Suspense key={suspKey} fallback={<LeadsTableSkeleton />}>
        <LeadsTableContent searchParams={searchParams} isAdmin={isAdmin} />
      </Suspense>
    </div>
  );
}
