import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import Link from 'next/link';
import { Search, Plus } from 'lucide-react';

const PAGE_SIZE = 25;

function buildHref(sp: Record<string, string | undefined>, overrides: Record<string, string | undefined>) {
  const merged = { ...sp, ...overrides };
  const params = new URLSearchParams();
  Object.entries(merged).forEach(([k, v]) => v && params.set(k, v));
  return `?${params.toString()}`;
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  await requireProfile();
  const supabase = await createClient();

  const page = Math.max(1, Number(searchParams.page ?? 1));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('customers')
    .select('id, full_name, phone, email, city, source, whatsapp_opt_in, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (searchParams.q) {
    query = query.or(
      `full_name.ilike.%${searchParams.q}%,phone.ilike.%${searchParams.q}%,email.ilike.%${searchParams.q}%`
    );
  }

  const { data: customers, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Customers</h1>
          <p className="text-sm text-ink-500">{count ?? 0} total customers</p>
        </div>
        <Link href="/admin/customers/new" className="btn-primary">
          <Plus className="h-4 w-4" /> New customer
        </Link>
      </div>

      <form className="flex items-center gap-3" method="get">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            name="q"
            defaultValue={searchParams.q}
            placeholder="Search name, phone, email…"
            className="input pl-9"
          />
        </div>
        <button type="submit" className="btn-outline">
          Search
        </button>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">City</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">WhatsApp opt-in</th>
              </tr>
            </thead>
            <tbody>
              {(customers ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-ink-400">
                    No customers found.
                  </td>
                </tr>
              )}
              {(customers ?? []).map((c) => (
                <tr key={c.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
                  <td className="px-5 py-3">
                    <Link href={`/admin/customers/${c.id}`} className="font-medium text-ink-800 hover:text-brand-700">
                      {c.full_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-ink-700">{c.phone}</p>
                    {c.email && <p className="text-xs text-ink-400">{c.email}</p>}
                  </td>
                  <td className="px-5 py-3 text-ink-600">{c.city ?? '—'}</td>
                  <td className="px-5 py-3 capitalize text-ink-600">{c.source.replace('_', ' ')}</td>
                  <td className="px-5 py-3">
                    <span className={`badge ${c.whatsapp_opt_in ? 'bg-brand-100 text-brand-800' : 'bg-ink-100 text-ink-500'}`}>
                      {c.whatsapp_opt_in ? 'Opted in' : 'Not opted in'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3 text-sm text-ink-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={buildHref(searchParams, { page: String(page - 1) })} className="btn-outline px-3 py-1.5">
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link href={buildHref(searchParams, { page: String(page + 1) })} className="btn-outline px-3 py-1.5">
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
