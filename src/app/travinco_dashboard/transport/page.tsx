import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireProfile, assertPageAccess } from '@/lib/supabase/auth-helpers';
import { assertTourAccess, canEditMasters, isAdminRole } from '@/lib/tour/access';
import { getTransportVehiclesTableList } from './actions';
import { TransportClient } from './transport-client';

export const metadata: Metadata = { title: 'Transportation — Admin Portal' };

const PAGE_SIZE = 20;

function TransportTableSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="px-5 py-3">Car type</th>
              <th className="px-5 py-3">Company</th>
              <th className="px-5 py-3">Contact</th>
              <th className="px-5 py-3 text-right">Amount</th>
              <th className="px-5 py-3 text-right">Free km</th>
              <th className="px-5 py-3 text-right">Extra / km</th>
              <th className="px-5 py-3 text-right">Bata / day</th>
              <th className="px-5 py-3 text-center">Active</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-ink-50 last:border-0">
                <td className="px-5 py-3">
                  <div className="h-4 w-28 animate-pulse rounded bg-ink-200/70 mb-1.5" />
                  <div className="h-3 w-20 animate-pulse rounded bg-ink-100" />
                </td>
                <td className="px-5 py-3">
                  <div className="h-4 w-28 animate-pulse rounded bg-ink-200/70 mb-1.5" />
                  <div className="h-3 w-20 animate-pulse rounded bg-ink-100" />
                </td>
                <td className="px-5 py-3">
                  <div className="h-4 w-24 animate-pulse rounded bg-ink-200/70 mb-1.5" />
                  <div className="h-3 w-20 animate-pulse rounded bg-ink-100" />
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="h-4 w-16 animate-pulse rounded bg-ink-100 ml-auto" />
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="h-4 w-16 animate-pulse rounded bg-ink-100 ml-auto" />
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="h-4 w-12 animate-pulse rounded bg-ink-100 ml-auto" />
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="h-4 w-12 animate-pulse rounded bg-ink-100 ml-auto" />
                </td>
                <td className="px-5 py-3 text-center">
                  <div className="h-5 w-12 animate-pulse rounded-full bg-ink-100 mx-auto" />
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="h-8 w-16 animate-pulse rounded bg-ink-100 ml-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function TransportContent({
  canEdit,
  canDelete,
  searchParams,
}: {
  canEdit: boolean;
  canDelete: boolean;
  searchParams: { q?: string; vehicle_type?: string; page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page ?? 1));

  const {
    vehicles,
    totalCount,
    totalPages,
    carTypes,
  } = await getTransportVehiclesTableList({
    page,
    pageSize: PAGE_SIZE,
    q: searchParams.q,
    vehicleType: searchParams.vehicle_type,
  });

  return (
    <TransportClient
      vehicles={vehicles}
      totalCount={totalCount}
      totalPages={totalPages}
      page={page}
      pageSize={PAGE_SIZE}
      carTypes={carTypes}
      canEdit={canEdit}
      canDelete={canDelete}
      searchParams={searchParams}
    />
  );
}

export default async function TransportPage({
  searchParams,
}: {
  searchParams: { q?: string; vehicle_type?: string; page?: string };
}) {
  const profile = await requireProfile();
  await assertPageAccess(profile, 'transport');
  assertTourAccess(profile, 'masters');
  const editable = canEditMasters(profile);
  const isAdmin = isAdminRole(profile);

  const suspKey = `${searchParams.q ?? ''}-${searchParams.vehicle_type ?? ''}-${searchParams.page ?? '1'}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Transportation</h1>
        <p className="text-sm text-ink-500">
          Vehicles and transport companies. Quotations charge the amount, then extra kilometres above the free limit at the per-km rate.
        </p>
      </div>
      <Suspense key={suspKey} fallback={<TransportTableSkeleton />}>
        <TransportContent
          canEdit={editable}
          canDelete={isAdmin}
          searchParams={searchParams}
        />
      </Suspense>
    </div>
  );
}
