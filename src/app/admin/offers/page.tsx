import { createClient } from '@/lib/supabase/server';
import { requireProfile, assertModulePermission } from '@/lib/supabase/auth-helpers';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate } from '@/lib/utils/format';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { OfferRowActions } from './offer-row-actions';
import { Suspense } from 'react';

/* ── skeleton ─────────────────────────────────────────────── */
function OffersTableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-ink-50 last:border-0">
          {Array.from({ length: 6 }).map((_, j) => (
            <td key={j} className="px-5 py-3">
              <div className="h-4 w-full animate-pulse rounded bg-ink-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/* ── data rows (streamed) ─────────────────────────────────── */
async function OffersRows() {
  const profile = await requireProfile();
  await assertModulePermission(profile, 'offers', 'view');
  const supabase = await createClient();
  const { data: offers } = await supabase
    .from('offers')
    .select('*, travel_packages(title)')
    .order('created_at', { ascending: false });

  if ((offers ?? []).length === 0) {
    return (
      <tr>
        <td colSpan={6} className="px-5 py-10 text-center text-ink-400">
          No offers yet.
        </td>
      </tr>
    );
  }

  return (
    <>
      {(offers ?? []).map((o) => (
        <tr key={o.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
          <td className="px-5 py-3">
            <Link href={`/admin/offers/${o.id}`} className="font-medium text-ink-800 hover:text-brand-700">
              {o.title}
            </Link>
          </td>
          <td className="px-5 py-3 text-ink-500">
            {(() => {
              const pkg = o.travel_packages as { title: string } | { title: string }[] | null;
              return (Array.isArray(pkg) ? pkg[0]?.title : pkg?.title) ?? '—';
            })()}
          </td>
          <td className="px-5 py-3 text-ink-600">
            {o.discount_percent ? `${o.discount_percent}%` : o.discount_flat ? `₹${o.discount_flat}` : '—'}
          </td>
          <td className="px-5 py-3 text-ink-500">
            {formatDate(o.valid_from)} – {formatDate(o.valid_to)}
          </td>
          <td className="px-5 py-3">
            <StatusBadge status={o.status} />
          </td>
          <td className="px-5 py-3 text-right">
            <OfferRowActions id={o.id} status={o.status} />
          </td>
        </tr>
      ))}
    </>
  );
}

/* ── page shell (instant) ─────────────────────────────────── */
export default function AdminOffersPage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink-900">Offers</h1>
        <Link href="/admin/offers/new" className="btn-primary">
          <Plus className="h-4 w-4" /> New offer
        </Link>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Package</th>
                <th className="px-5 py-3">Discount</th>
                <th className="px-5 py-3">Valid</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <Suspense fallback={<OffersTableSkeleton />}>
                <OffersRows />
              </Suspense>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
