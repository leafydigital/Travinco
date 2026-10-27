import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { canEditMasters } from '@/lib/tour/access';
import { getLocationsTableList } from './actions';
import { LocationsClient } from './locations-client';
import LocationsLoading from './loading';

export const metadata: Metadata = { title: 'Locations — Admin Portal' };

const PAGE_SIZE = 20;

async function LocationsContent({
  canEdit,
  canDelete,
  searchParams,
}: {
  canEdit: boolean;
  canDelete: boolean;
  searchParams: { q?: string; state?: string; page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page ?? 1));

  const {
    locations,
    totalCount,
    totalPages,
    states,
    parentLocations,
  } = await getLocationsTableList({
    page,
    pageSize: PAGE_SIZE,
    q: searchParams.q,
    state: searchParams.state,
  });

  return (
    <LocationsClient
      locations={locations}
      totalCount={totalCount}
      totalPages={totalPages}
      page={page}
      pageSize={PAGE_SIZE}
      states={states}
      parentLocations={parentLocations}
      canEdit={canEdit}
      canDelete={canDelete}
      searchParams={searchParams}
    />
  );
}

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: { q?: string; state?: string; page?: string };
}) {
  const profile = await requireProfile();
  const editable = canEditMasters(profile);
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';

  const suspKey = `${searchParams.q ?? ''}-${searchParams.state ?? ''}-${searchParams.page ?? '1'}`;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-ink-900">Locations</h2>
        <p className="text-sm text-ink-500">Manage destination locations used in tours and quotations.</p>
      </div>
      <Suspense key={suspKey} fallback={<LocationsLoading />}>
        <LocationsContent
          canEdit={editable}
          canDelete={isAdmin}
          searchParams={searchParams}
        />
      </Suspense>
    </div>
  );
}
