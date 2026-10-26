import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, ArrowLeft } from 'lucide-react';
import { requireProfile, assertModulePermission } from '@/lib/supabase/auth-helpers';
import { getDestinationsTableList } from './actions';
import { DestinationsTable } from './destinations-table';
import { BulkCreateDestinationsButton } from './bulk-create-modal';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  searchParams: {
    page?: string;
    q?: string;
    status?: string;
  };
}

function DestinationsTableSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="w-full">
        <table className="w-full text-sm table-auto">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400 bg-sand-50/40">
              <th className="w-14 px-3 sm:px-4 py-3 font-semibold">Image</th>
              <th className="px-3 sm:px-4 py-3 font-semibold">Destination</th>
              <th className="px-3 sm:px-4 py-3 font-semibold">Country</th>
              <th className="px-3 sm:px-4 py-3 font-semibold">Featured</th>
              <th className="px-3 sm:px-4 py-3 font-semibold">Status</th>
              <th className="w-[1%] whitespace-nowrap px-3 sm:px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-50">
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                <td className="w-14 px-3 sm:px-4 py-3">
                  <div className="h-10 w-12 rounded-lg bg-ink-200/70" />
                </td>
                <td className="px-3 sm:px-4 py-3">
                  <div className="h-4 w-40 rounded bg-ink-200/70" />
                  <div className="h-3 w-20 rounded bg-ink-100 mt-1.5" />
                </td>
                <td className="px-3 sm:px-4 py-3">
                  <div className="h-4 w-24 rounded bg-ink-100" />
                </td>
                <td className="px-3 sm:px-4 py-3">
                  <div className="h-5 w-16 rounded-full bg-ink-100" />
                </td>
                <td className="px-3 sm:px-4 py-3">
                  <div className="h-5 w-16 rounded-full bg-ink-100" />
                </td>
                <td className="px-3 sm:px-4 py-3 text-right">
                  <div className="h-7 w-20 rounded-lg bg-ink-100 ml-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function DestinationsTableContent({
  searchParams,
  isAdmin,
}: {
  searchParams: PageProps['searchParams'];
  isAdmin: boolean;
}) {
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const q = searchParams.q ?? '';
  const status = searchParams.status ?? 'all';

  const result = await getDestinationsTableList({
    page,
    pageSize: 20,
    q,
    status,
  });

  return (
    <DestinationsTable
      destinations={result.destinations}
      totalCount={result.totalCount}
      totalPages={result.totalPages}
      currentPage={result.page}
      pageSize={result.pageSize}
      isAdmin={isAdmin}
      initialSearch={q}
      initialStatus={status}
    />
  );
}

export default async function AdminDestinationsPage({ searchParams }: PageProps) {
  const profile = await requireProfile();
  await assertModulePermission(profile, 'destinations', 'view');
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header (Paints instantly <50ms without blocking on table queries) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-100 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Link
              href="/travinco_dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-brand-700 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Dashboard</span>
            </Link>
          </div>

          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
              Destinations
            </h1>
          </div>

          <p className="text-sm text-ink-500 max-w-2xl leading-relaxed">
            Curate popular travel destinations, regional descriptions, cover visuals, and publishing status.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <BulkCreateDestinationsButton />
          <Link
            href="/travinco_dashboard/destinations/new"
            prefetch={true}
            className="btn-primary inline-flex items-center gap-2 shadow-2xs hover:shadow-xs transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New destination</span>
          </Link>
        </div>
      </div>

      {/* 2. Fast Streaming Table with Skeleton */}
      <Suspense fallback={<DestinationsTableSkeleton />}>
        <DestinationsTableContent searchParams={searchParams} isAdmin={isAdmin} />
      </Suspense>
    </div>
  );
}
