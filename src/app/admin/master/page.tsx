import type { Metadata } from 'next';
import { requireProfile, assertRole } from '@/lib/supabase/auth-helpers';
import { getMasterRatesFromDb, getMasterFilterOptions } from '@/lib/services/master-rates-db';
import { MasterClient } from './master-client';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Master Data — Admin Portal',
};

/* ── data (streamed) ──────────────────────────────────────── */
async function MasterContent() {
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

/* ── page shell (instant) ─────────────────────────────────── */
export default function AdminMasterPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Master Data</h1>
        <p className="text-sm text-ink-500">Hotel rates, room types and pricing data.</p>
      </div>
      <Suspense fallback={
        <div className="card p-6">
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-ink-100" />
            ))}
          </div>
        </div>
      }>
        <MasterContent />
      </Suspense>
    </div>
  );
}
