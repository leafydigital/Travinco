import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { getPluginsTableList } from './actions';
import { PluginsClient } from './plugins-client';

export const metadata: Metadata = {
  title: 'Plugins & Widgets — Travinco Admin',
  description: 'Manage third-party widgets and script integrations for the customer website.',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  searchParams: {
    page?: string;
    q?: string;
    slot?: string;
  };
}

function PluginsTableSkeleton() {
  return (
    <div className="space-y-6">
      {/* Top Banner Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded-lg bg-ink-100 animate-pulse" />
          <div className="h-4 w-96 rounded bg-ink-100 animate-pulse" />
        </div>
        <div className="h-10 w-32 rounded-xl bg-ink-100 animate-pulse" />
      </div>

      {/* Filter and Search Skeleton */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="h-10 w-full max-w-md rounded-xl bg-ink-100 animate-pulse" />
        <div className="h-10 w-48 rounded-xl bg-ink-100 animate-pulse" />
      </div>

      {/* Table Skeleton */}
      <div className="overflow-hidden rounded-xl border border-ink-200/80 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-ink-700">
            <thead className="border-b border-ink-100 bg-ink-50/75 text-xs font-semibold uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-5 py-3.5">Plugin / Widget</th>
                <th className="px-4 py-3.5">Slot Location</th>
                <th className="px-4 py-3.5 text-center">Position</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5">Created</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-5 py-4">
                    <div className="h-4 w-40 rounded bg-ink-200/70" />
                    <div className="h-3 w-56 rounded bg-ink-100 mt-1.5" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-5 w-24 rounded-full bg-ink-100" />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="h-6 w-8 rounded-md bg-ink-100 mx-auto" />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="h-6 w-16 rounded-full bg-ink-100 mx-auto" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-4 w-20 rounded bg-ink-100" />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="h-7 w-28 rounded-lg bg-ink-100 ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

async function PluginsContent({ searchParams }: PageProps) {
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const q = searchParams.q ?? '';
  const slot = searchParams.slot ?? 'all';

  const result = await getPluginsTableList({
    page,
    pageSize: 20,
    q,
    slot,
  });

  return (
    <PluginsClient
      initialPlugins={result.plugins}
      totalCount={result.totalCount}
      totalPages={result.totalPages}
      currentPage={result.page}
      pageSize={result.pageSize}
      initialSearch={q}
      initialSlot={slot}
    />
  );
}

export default async function AdminPluginsPage({ searchParams }: PageProps) {
  const profile = await requireProfile();

  // Strict admin authorization: only admin and super_admin can configure plugins
  if (profile.role !== 'admin' && profile.role !== 'super_admin') {
    redirect('/travinco_dashboard?error=unauthorized');
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <Suspense fallback={<PluginsTableSkeleton />}>
        <PluginsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
