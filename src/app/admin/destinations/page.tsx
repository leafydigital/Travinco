import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { requireProfile, assertModulePermission } from '@/lib/supabase/auth-helpers';
import { StatusBadge } from '@/components/ui/status-badge';
import Link from 'next/link';
import { Plus, ArrowLeft } from 'lucide-react';
import { DestinationRowActions } from './destination-row-actions';

function DestinationsTableSkeleton() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <th className="px-5 py-3">Name</th>
            <th className="px-5 py-3">Country</th>
            <th className="px-5 py-3">Featured</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-50">
          {Array.from({ length: 6 }).map((_, i) => (
            <tr key={i} className="animate-pulse">
              <td className="px-5 py-3.5"><div className="h-4 w-32 rounded bg-ink-200/70" /></td>
              <td className="px-5 py-3.5"><div className="h-4 w-20 rounded bg-ink-100" /></td>
              <td className="px-5 py-3.5"><div className="h-4 w-12 rounded bg-ink-100" /></td>
              <td className="px-5 py-3.5"><div className="h-6 w-16 rounded-full bg-ink-100" /></td>
              <td className="px-5 py-3.5 text-right"><div className="h-8 w-8 rounded-lg bg-ink-100 ml-auto" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function DestinationsTableContent() {
  const profile = await requireProfile();
  await assertModulePermission(profile, 'destinations', 'view');
  const supabase = await createClient();
  const { data: destinations } = await supabase.from('destinations').select('*').order('sort_order');

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <th className="px-5 py-3">Name</th>
            <th className="px-5 py-3">Country</th>
            <th className="px-5 py-3">Featured</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {(destinations ?? []).length === 0 && (
            <tr>
              <td colSpan={5} className="px-5 py-10 text-center text-ink-400">
                No destinations yet.
              </td>
            </tr>
          )}
          {(destinations ?? []).map((d) => (
            <tr key={d.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
              <td className="px-5 py-3">
                <Link
                  href={`/admin/destinations/${d.id}`}
                  className="font-medium text-ink-800 hover:text-brand-700"
                >
                  {d.name}
                </Link>
              </td>
              <td className="px-5 py-3 text-ink-500">{d.country ?? '—'}</td>
              <td className="px-5 py-3">{d.is_featured ? 'Yes' : 'No'}</td>
              <td className="px-5 py-3">
                <StatusBadge status={d.is_active ? 'active' : 'inactive'} />
              </td>
              <td className="px-5 py-3 text-right">
                <DestinationRowActions id={d.id} status={d.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminDestinationsPage() {
  return (
    <div className="space-y-5">
      {/* 1. Header Structure (Renders Instantly) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="mb-1 flex items-center gap-1 text-sm text-ink-500 hover:text-brand-700">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
          <h1 className="text-xl font-semibold text-ink-900">Destinations</h1>
        </div>
        <Link href="/admin/destinations/new" prefetch={true} className="btn-primary">
          <Plus className="h-4 w-4" /> New destination
        </Link>
      </div>

      {/* 2. Table Card (Header loads immediately, rows show skeleton only while fetching) */}
      <div className="card overflow-hidden">
        <Suspense fallback={<DestinationsTableSkeleton />}>
          <DestinationsTableContent />
        </Suspense>
      </div>
    </div>
  );
}
