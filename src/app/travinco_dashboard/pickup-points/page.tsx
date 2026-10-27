import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireProfile, assertPageAccess } from '@/lib/supabase/auth-helpers';
import { assertTourAccess, canEditMasters } from '@/lib/tour/access';
import { getPickupPointsTableList } from './actions';
import { PickupPointsClient } from './pickup-points-client';
import PickupPointsLoading from './loading';

export const metadata: Metadata = { title: 'Pickup & Drop Points — Admin Portal' };

const PAGE_SIZE = 20;

async function PickupPointsContent({
  canEdit,
  canDelete,
  searchParams,
}: {
  canEdit: boolean;
  canDelete: boolean;
  searchParams: { q?: string; point_type?: string; location_id?: string; page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page ?? 1));

  const {
    points,
    totalCount,
    totalPages,
    locations,
  } = await getPickupPointsTableList({
    page,
    pageSize: PAGE_SIZE,
    q: searchParams.q,
    pointType: searchParams.point_type,
    locationId: searchParams.location_id,
  });

  return (
    <PickupPointsClient
      points={points}
      totalCount={totalCount}
      totalPages={totalPages}
      page={page}
      pageSize={PAGE_SIZE}
      locations={locations}
      canEdit={canEdit}
      canDelete={canDelete}
      searchParams={searchParams}
    />
  );
}

export default async function PickupPointsPage({
  searchParams,
}: {
  searchParams: { q?: string; point_type?: string; location_id?: string; page?: string };
}) {
  const profile = await requireProfile();
  await assertPageAccess(profile, 'pickup_points');
  assertTourAccess(profile, 'masters');
  const editable = canEditMasters(profile);
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';

  const suspKey = `${searchParams.q ?? ''}-${searchParams.point_type ?? ''}-${searchParams.location_id ?? ''}-${searchParams.page ?? '1'}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Pickup &amp; Drop Points</h1>
        <p className="text-sm text-ink-500">
          Airports, stations and other places where guests are picked up or dropped.
        </p>
      </div>
      <Suspense key={suspKey} fallback={<PickupPointsLoading />}>
        <PickupPointsContent
          canEdit={editable}
          canDelete={isAdmin}
          searchParams={searchParams}
        />
      </Suspense>
    </div>
  );
}
