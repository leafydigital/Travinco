import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Search, Phone, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { assertTourAccess, canEditMasters } from '@/lib/tour/access';
import { Suspense } from 'react';

export const metadata: Metadata = { title: 'Hotels — Admin Portal' };

const PAGE_SIZE = 30;

type SearchParams = { q?: string; location?: string; category?: string; contact?: string; page?: string };

/* ── skeleton ─────────────────────────────────────────────── */
function HotelsTableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
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

/* ── data section (streamed) ──────────────────────────────── */
async function HotelsContent({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  assertTourAccess(profile, 'masters');
  const supabase = await createClient();
  const page = Math.max(1, Number(searchParams.page ?? 1));

  let query = supabase
    .from('hotels')
    .select('id, name, area, is_active, contact_person, phone, whatsapp, email, location_id, default_category_id, locations(name), hotel_categories(name), room_types(count)', { count: 'exact' })
    .order('name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const term = (searchParams.q ?? '').replace(/[,()%*]/g, ' ').trim();
  if (term) query = query.or(`name.ilike.%${term}%,contact_person.ilike.%${term}%,phone.ilike.%${term}%,area.ilike.%${term}%`);
  if (searchParams.location) query = query.eq('location_id', Number(searchParams.location));
  if (searchParams.category) query = query.eq('default_category_id', Number(searchParams.category));
  if (searchParams.contact === 'missing') query = query.is('phone', null);

  const { data: hotels, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const href = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    Object.entries({ ...searchParams, ...o }).forEach(([k, v]) => v && p.set(k, v));
    return `?${p.toString()}`;
  };
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

  return (
    <>
      {(hotels ?? []).length === 0 && (
        <tr><td colSpan={6} className="px-5 py-10 text-center text-ink-400">No hotels found.</td></tr>
      )}
      {(hotels ?? []).map((h) => {
        const rooms = one(h.room_types as unknown as { count: number }[] | { count: number } | null)?.count ?? 0;
        return (
          <tr key={h.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
            <td className="px-5 py-3">
              <Link href={`/admin/hotels/${h.id}`} className="font-medium text-ink-800 hover:text-brand-700">{h.name}</Link>
              {h.area && <p className="text-xs text-ink-400">{h.area}</p>}
            </td>
            <td className="px-5 py-3 text-ink-600">{one(h.locations as unknown as { name: string } | { name: string }[] | null)?.name ?? '—'}</td>
            <td className="px-5 py-3 text-ink-600">{one(h.hotel_categories as unknown as { name: string } | { name: string }[] | null)?.name ?? '—'}</td>
            <td className="px-5 py-3">
              {h.contact_person && <p className="text-ink-700">{h.contact_person}</p>}
              {h.phone ? (
                <a href={`tel:${h.phone}`} className="inline-flex items-center gap-1 text-ink-600 hover:text-brand-700"><Phone className="h-3 w-3" />{h.phone}</a>
              ) : (
                <span className="badge bg-sand-100 text-sand-800">No phone</span>
              )}
              {h.email && <p className="flex items-center gap-1 text-xs text-ink-400"><Mail className="h-3 w-3" />{h.email}</p>}
            </td>
            <td className="px-5 py-3 text-right tabular-nums text-ink-600">{rooms}</td>
            <td className="px-5 py-3 text-center">
              <span className={`badge ${h.is_active ? 'bg-brand-100 text-brand-800' : 'bg-ink-100 text-ink-500'}`}>{h.is_active ? 'Yes' : 'No'}</span>
            </td>
          </tr>
        );
      })}
      {totalPages > 1 && (
        <tr>
          <td colSpan={6} className="border-t border-ink-100 px-5 py-3">
            <div className="flex items-center justify-between text-sm text-ink-500">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                {page > 1 && <Link href={href({ page: String(page - 1) })} className="btn-outline px-3 py-1.5">Previous</Link>}
                {page < totalPages && <Link href={href({ page: String(page + 1) })} className="btn-outline px-3 py-1.5">Next</Link>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ── filter shell (needs location/category options) ───────── */
async function HotelsFilters({ searchParams, canEdit }: { searchParams: SearchParams; canEdit: boolean }) {
  const profile = await requireProfile();
  assertTourAccess(profile, 'masters');
  const supabase = await createClient();
  const [{ data: locs }, { data: cats }] = await Promise.all([
    supabase.from('locations').select('id, name').order('name'),
    supabase.from('hotel_categories').select('id, name').order('sort_order'),
  ]);

  return (
    <>
      {canEdit && (
        <Link href="/admin/hotels/new" className="btn-primary">
          <Plus className="h-4 w-4" /> New hotel
        </Link>
      )}
      <form method="get" className="flex flex-wrap items-center gap-3 col-span-full">
        <div className="relative min-w-[220px] max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input name="q" defaultValue={searchParams.q} placeholder="Search hotel, contact, phone, area…" className="input pl-9" />
        </div>
        <select name="location" defaultValue={searchParams.location ?? ''} className="input w-auto" aria-label="Location">
          <option value="">All locations</option>
          {(locs ?? []).map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <select name="category" defaultValue={searchParams.category ?? ''} className="input w-auto" aria-label="Category">
          <option value="">All categories</option>
          {(cats ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select name="contact" defaultValue={searchParams.contact ?? ''} className="input w-auto" aria-label="Contact details">
          <option value="">Any contact status</option>
          <option value="missing">Phone missing</option>
        </select>
        <button type="submit" className="btn-outline">Filter</button>
      </form>
    </>
  );
}

/* ── page shell (instant) ─────────────────────────────────── */
export default async function HotelsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireProfile();
  assertTourAccess(profile, 'masters');
  const editable = canEditMasters(profile);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Hotels</h1>
          <p className="text-sm text-ink-500">
            Contact details, rooms and Rate Master prices. Rates are imported under{' '}
            <Link href="/admin/master" className="text-brand-700 hover:underline">Master</Link>.
          </p>
        </div>
        <Suspense fallback={
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-9 w-28 animate-pulse rounded bg-ink-100" />
          </div>
        }>
          <HotelsFilters searchParams={searchParams} canEdit={editable} />
        </Suspense>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3">Hotel</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3 text-right">Rooms</th>
                <th className="px-5 py-3 text-center">Active</th>
              </tr>
            </thead>
            <tbody>
              <Suspense fallback={<HotelsTableSkeleton />}>
                <HotelsContent searchParams={searchParams} />
              </Suspense>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
