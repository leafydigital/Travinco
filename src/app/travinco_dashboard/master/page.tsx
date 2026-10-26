import type { Metadata } from 'next';
import { requireProfile, assertPageAccess } from '@/lib/supabase/auth-helpers';
import { getMasterRatesFromDb, getMasterFilterOptions } from '@/lib/services/master-rates-db';
import { MasterClient } from './master-client';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Rate Master — Admin Portal',
};

/* ── data (streamed) ──────────────────────────────────────── */
async function MasterContent() {
  const profile = await requireProfile();
  await assertPageAccess(profile, 'master');
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';

  const [initialData, filterOptions] = await Promise.all([
    getMasterRatesFromDb({ page: 1, pageSize: 20 }),
    getMasterFilterOptions(),
  ]);

  return (
    <MasterClient
      initialData={initialData}
      filterOptions={filterOptions}
      isAdmin={isAdmin}
    />
  );
}

/* ── page shell (instant) ─────────────────────────────────── */
export default async function AdminMasterPage() {
  const profile = await requireProfile();
  await assertPageAccess(profile, 'master');

  return (
    <div className="space-y-5">
      <Suspense fallback={
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-ink-100 pb-5">
            <div className="space-y-2">
              <div className="h-8 w-48 animate-pulse rounded bg-ink-100" />
              <div className="h-4 w-96 animate-pulse rounded bg-ink-100" />
            </div>
            <div className="h-10 w-32 animate-pulse rounded-xl bg-ink-100" />
          </div>
          <div className="card p-6">
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-ink-100" />
              ))}
            </div>
          </div>
        </div>
      }>
        <MasterContent />
      </Suspense>
    </div>
  );
}
