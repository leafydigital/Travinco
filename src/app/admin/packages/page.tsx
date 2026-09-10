import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/utils/format';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { PackageRowActions } from './package-row-actions';

const PAGE_SIZE = 20;

function buildPageHref(
  searchParams: { q?: string; status?: string; page?: string },
  page: number
) {
  const params = new URLSearchParams();
  if (searchParams.q) params.set('q', searchParams.q);
  if (searchParams.status) params.set('status', searchParams.status);
  params.set('page', String(page));
  return `?${params.toString()}`;
}

export default async function AdminPackagesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string };
}) {
  await requireProfile();
  const supabase = await createClient();

  const page = Math.max(1, Number(searchParams.page ?? 1));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('travel_packages')
    .select('id, title, slug, status, base_price, discount_price, currency, is_featured, destinations(name)', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (searchParams.q) {
    query = query.ilike('title', `%${searchParams.q}%`);
  }
  if (searchParams.status && searchParams.status !== 'all') {
    query = query.eq('status', searchParams.status);
  }

  const { data: packages, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Travel packages</h1>
          <p className="text-sm text-ink-500">{count ?? 0} total packages</p>
        </div>
        <Link href="/admin/packages/new" className="btn-primary">
          <Plus className="h-4 w-4" /> New package
        </Link>
      </div>

      <form className="flex flex-wrap items-center gap-3" method="get">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            name="q"
            defaultValue={searchParams.q}
            placeholder="Search by package name…"
            className="input pl-9"
          />
        </div>
        <select name="status" defaultValue={searchParams.status ?? 'all'} className="input w-auto">
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <button type="submit" className="btn-outline">
          Filter
        </button>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3">Package</th>
                <th className="px-5 py-3">Destination</th>
                <th className="px-5 py-3">Price</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(packages ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-ink-400">
                    No packages found. Try adjusting your search or create a new one.
                  </td>
                </tr>
              )}
              {(packages ?? []).map((pkg) => (
                <tr key={pkg.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/packages/${pkg.id}`}
                      className="font-medium text-ink-800 hover:text-brand-700"
                    >
                      {pkg.title}
                    </Link>
                    {pkg.is_featured && (
                      <span className="ml-2 badge bg-sand-100 text-sand-800">Featured</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-ink-600">
                    {(pkg.destinations as { name: string } | null)?.name ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-ink-700">
                    {pkg.discount_price ? (
                      <span>
                        <span className="text-ink-400 line-through mr-1.5">
                          {formatCurrency(pkg.base_price, pkg.currency)}
                        </span>
                        {formatCurrency(pkg.discount_price, pkg.currency)}
                      </span>
                    ) : (
                      formatCurrency(pkg.base_price, pkg.currency)
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={pkg.status} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <PackageRowActions id={pkg.id} status={pkg.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3 text-sm text-ink-500">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={buildPageHref(searchParams, page - 1)}
                  className="btn-outline px-3 py-1.5"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={buildPageHref(searchParams, page + 1)}
                  className="btn-outline px-3 py-1.5"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
