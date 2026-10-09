import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Plus, Search, Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { assertTourAccess, isAdminRole } from '@/lib/tour/access';
import { loadTourMasters } from '@/lib/tour/data';
import { formatDate } from '@/lib/utils/format';
import { QuoteStatusBadge } from '@/components/tour/status-badges';

export const metadata: Metadata = { title: 'Quotations — Admin Portal' };

const PAGE_SIZE = 25;
const STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'invoiced'];

function QuotationsTableSkeleton() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <th className="px-5 py-3">Quotation</th>
            <th className="px-5 py-3">Guest</th>
            <th className="px-5 py-3">Trip</th>
            <th className="px-5 py-3 text-right">Total</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Created</th>
            <th className="px-5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-50">
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i} className="animate-pulse">
              <td className="px-5 py-3.5">
                <div className="h-4 w-28 rounded bg-ink-200/70 mb-2" />
                <div className="h-3 w-40 rounded bg-ink-100" />
              </td>
              <td className="px-5 py-3.5">
                <div className="h-4 w-24 rounded bg-ink-200/70 mb-2" />
                <div className="h-3 w-28 rounded bg-ink-100" />
              </td>
              <td className="px-5 py-3.5">
                <div className="h-4 w-24 rounded bg-ink-200/70 mb-2" />
                <div className="h-3 w-32 rounded bg-ink-100" />
              </td>
              <td className="px-5 py-3.5 text-right">
                <div className="h-4 w-20 rounded bg-ink-200/70 ml-auto mb-2" />
                <div className="h-3 w-16 rounded bg-ink-100 ml-auto" />
              </td>
              <td className="px-5 py-3.5">
                <div className="h-6 w-16 rounded-full bg-ink-100" />
              </td>
              <td className="px-5 py-3.5">
                <div className="h-4 w-24 rounded bg-ink-200/70 mb-2" />
                <div className="h-3 w-20 rounded bg-ink-100" />
              </td>
              <td className="px-5 py-3.5 text-right">
                <div className="h-8 w-16 rounded bg-ink-100 ml-auto" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function QuotationsTableContent({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string };
}) {
  const supabase = await createClient();
  const page = Math.max(1, Number(searchParams.page ?? 1));

  let query = supabase
    .from('quotations')
    .select(
      'id, quote_number, status, guest_name, guest_phone, title, start_date, nights, adults, total_amount, total_amount2, valid_until, created_at, profiles:created_by(full_name)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const term = (searchParams.q ?? '').replace(/[,()%*]/g, ' ').trim();
  if (term) {
    query = query.or(
      `quote_number.ilike.%${term}%,guest_name.ilike.%${term}%,guest_phone.ilike.%${term}%`
    );
  }
  if (searchParams.status && STATUSES.includes(searchParams.status)) {
    query = query.eq('status', searchParams.status);
  }

  const [{ data: rows, count }] = await Promise.all([
    query,
    loadTourMasters().catch(() => null), // Pre-warm tour masters into memory
  ]);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const today = new Date().toISOString().slice(0, 10);

  const href = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    Object.entries({ ...searchParams, ...o }).forEach(([k, v]) => v && p.set(k, v));
    return `?${p.toString()}`;
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="px-5 py-3">Quotation</th>
              <th className="px-5 py-3">Guest</th>
              <th className="px-5 py-3">Trip</th>
              <th className="px-5 py-3 text-right">Total</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Created</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-ink-400">
                  No quotations yet.{' '}
                  <Link
                    href="/admin/quotations/new"
                    prefetch={true}
                    className="text-brand-700 hover:underline"
                  >
                    Create the first one
                  </Link>
                  .
                </td>
              </tr>
            )}
            {(rows ?? []).map((r) => {
              const by = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as
                | { full_name: string }
                | null
                | undefined;
              const expired = r.status === 'sent' && r.valid_until && r.valid_until < today;
              const isLocked = r.status === 'invoiced';
              return (
                <tr
                  key={r.id}
                  className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/quotations/${r.id}`}
                      className="font-medium text-ink-800 hover:text-brand-700"
                    >
                      {r.quote_number}
                    </Link>
                    <p className="max-w-[260px] truncate text-xs text-ink-400">{r.title}</p>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-ink-700">{r.guest_name}</p>
                    {r.guest_phone && <p className="text-xs text-ink-400">{r.guest_phone}</p>}
                  </td>
                  <td className="px-5 py-3 text-ink-600">
                    {formatDate(r.start_date)}
                    <p className="text-xs text-ink-400">
                      {r.nights + 1}D/{r.nights}N · {r.adults} adult{r.adults > 1 ? 's' : ''}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    <p className="font-medium text-ink-800">
                      ₹{Math.round(Number(r.total_amount)).toLocaleString('en-IN')}
                    </p>
                    {r.total_amount2 != null && (
                      <p className="text-xs text-ink-400">
                        Opt 2: ₹{Math.round(Number(r.total_amount2)).toLocaleString('en-IN')}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <QuoteStatusBadge status={r.status} />
                    {expired && <p className="mt-1 text-xs text-coral-700">validity passed</p>}
                  </td>
                  <td className="px-5 py-3 text-ink-500">
                    {formatDate(r.created_at)}
                    {by?.full_name && <p className="text-xs text-ink-400">{by.full_name}</p>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {!isLocked && (
                        <Link
                          href={`/admin/quotations/${r.id}/edit`}
                          className="btn-outline h-8 px-2.5 text-xs text-brand-700 hover:bg-brand-50"
                        >
                          Edit
                        </Link>
                      )}
                      <Link
                        href={`/admin/quotations/${r.id}`}
                        className="btn-ghost h-8 px-2 text-xs text-ink-500 hover:text-ink-900"
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3 text-sm text-ink-500">
          <span>
            Page {page} of {totalPages} ({count ?? 0} total)
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={href({ page: String(page - 1) })}
                className="btn-outline px-3 py-1.5"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={href({ page: String(page + 1) })}
                className="btn-outline px-3 py-1.5"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string };
}) {
  const profile = await requireProfile();
  assertTourAccess(profile, 'quotations');

  const href = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    Object.entries({ ...searchParams, ...o }).forEach(([k, v]) => v && p.set(k, v));
    return `?${p.toString()}`;
  };

  const suspKey = `${searchParams.q ?? ''}-${searchParams.status ?? ''}-${searchParams.page ?? '1'}`;

  return (
    <div className="space-y-5">
      {/* 1. Header Structure (Renders Instantly) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Quotations</h1>
          <p className="text-sm text-ink-500">
            Priced from the Rate Master, convertible to invoices
          </p>
        </div>
        <div className="flex gap-2">
          {isAdminRole(profile) && (
            <Link
              href="/admin/quotations/settings"
              prefetch={true}
              className="btn-outline"
            >
              <Settings className="h-4 w-4" /> Settings
            </Link>
          )}
          <Link
            href="/admin/quotations/new"
            prefetch={true}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" /> New quotation
          </Link>
        </div>
      </div>

      {/* 2. Status Filters Structure (Renders Instantly) */}
      <div className="flex flex-wrap gap-1.5">
        {['', ...STATUSES].map((s) => (
          <Link
            key={s || 'all'}
            href={href({ status: s || undefined, page: undefined })}
            className={`badge capitalize ${(searchParams.status ?? '') === s ? 'bg-brand-700 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50'}`}
          >
            {s || 'All'}
          </Link>
        ))}
      </div>

      {/* 3. Search Bar (Renders Instantly) */}
      <form method="get" className="flex items-center gap-3">
        {searchParams.status && (
          <input type="hidden" name="status" value={searchParams.status} />
        )}
        <div className="relative min-w-[220px] max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            name="q"
            defaultValue={searchParams.q}
            placeholder="Search number, guest, phone…"
            className="input pl-9"
          />
        </div>
        <button type="submit" className="btn-outline">
          Search
        </button>
      </form>

      {/* 4. Table Container (Header loads immediately, rows show skeleton only while fetching) */}
      <div className="card overflow-hidden">
        <Suspense key={suspKey} fallback={<QuotationsTableSkeleton />}>
          <QuotationsTableContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
