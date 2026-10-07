import type { Metadata } from 'next';
import { requireProfile, assertRole } from '@/lib/supabase/auth-helpers';
import { getMasterRatesFromDb, getMasterFilterOptions } from '@/lib/services/master-rates-db';
import { MasterClient } from './master-client';

export const metadata: Metadata = {
  title: 'Master Data — Admin Portal',
};

export default async function AdminMasterPage() {
  const profile = await requireProfile();
  assertRole(profile, ['admin', 'super_admin']);

  const [initialData, filterOptions] = await Promise.all([
    getMasterRatesFromDb({ page: 1, pageSize: 25 }),
    getMasterFilterOptions(),
  ]);

  return (
    <MasterClient
      initialData={initialData}
      filterOptions={filterOptions}
    />
  );
}
