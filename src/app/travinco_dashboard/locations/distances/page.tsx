import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { canEditMasters } from '@/lib/tour/access';
import { getDistancesTableList } from './actions';
import { DistancesClient } from './distances-client';
import DistancesLoading from './loading';

export const metadata: Metadata = { title: 'Distances — Admin Portal' };

const PAGE_SIZE = 20;

async function DistancesContent({
  canEdit,
  canDelete,
  searchParams,
}: {
  canEdit: boolean;
  canDelete: boolean;
  searchParams: { q?: string; location_id?: string; page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page ?? 1));

  const {
    distances,
    totalCount,
    totalPages,
    locations,
  } = await getDistancesTableList({
    page,
    pageSize: PAGE_SIZE,
    q: searchParams.q,
    locationId: searchParams.location_id,
  });

  return (
    <DistancesClient
      distances={distances}
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

export default async function DistancesPage({
  searchParams,
}: {
  searchParams: { q?: string; location_id?: string; page?: string };
}) {
  const profile = await requireProfile();
  const editable = canEditMasters(profile);
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';

  const suspKey = `${searchParams.q ?? ''}-${searchParams.location_id ?? ''}-${searchParams.page ?? '1'}`;

  return (
    <Suspense key={suspKey} fallback={<DistancesLoading />}>
      <DistancesContent
        canEdit={editable}
        canDelete={isAdmin}
        searchParams={searchParams}
      />
    </Suspense>
  );
}
