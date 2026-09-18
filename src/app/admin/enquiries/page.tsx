import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate } from '@/lib/utils/format';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { EnquiryRowActions } from './enquiry-row-actions';

const PAGE_SIZE = 25;

const statusOptions = [
  'new', 'contacted', 'follow_up', 'quotation_sent', 'negotiation',
  'confirmed', 'lost', 'closed',
];

function buildHref(
  sp: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>
) {
  const merged = { ...sp, ...overrides };
  const params = new URLSearchParams();
  Object.entries(merged).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  return `?${params.toString()}`;
}

export default async function AdminEnquiriesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; priority?: string; view?: string; page?: string };
}) {
  await requireProfile();
  const supabase = await createClient();

  const page = Math.max(1, Number(searchParams.page ?? 1));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const today = new Date().toISOString().slice(0, 10);

  let query = supabase
    .from('enquiries')
    .select(
      'id, enquiry_number, customer_name, phone, status, priority, source, next_followup_date, created_at, assigned_staff, profiles(full_name)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (searchParams.q) {
    query = query.or(
      `customer_name.ilike.%${searchParams.q}%,phone.ilike.%${searchParams.q}%,enquiry_number.ilike.%${searchParams.q}%`
    );
  }
  if (searchParams.status) query = query.eq('status', searchParams.status);
  if (searchParams.priority) query = query.eq('priority', searchParams.priority);

  if (searchParams.view === 'followup_today') {
    query = query.eq('next_followup_date', today);
  } else if (searchParams.view === 'overdue') {
    query = query.lt('next_followup_date', today).eq('status', 'follow_up');
  }

  const { data: enquiries, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Enquiries</h1>
        <p className="text-sm text-ink-500">{count ?? 0} total enquiries</p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/enquiries"
          className={`btn-outline ${!searchParams.view ? 'bg-brand-50 border-brand-300 text-brand-700' : ''}`}
        >
          All
        </Link>
        <Link
          href={buildHref(searchParams, { view: 'followup_today', page: undefined })}
          className={`btn-outline ${searchParams.view === 'followup_today' ? 'bg-brand-50 border-brand-300 text-brand-700' : ''}`}
        >
          Follow-ups today
        </Link>
        <Link
          href={buildHref(searchParams, { view: 'overdue', page: undefined })}
          className={`btn-outline ${searchParams.view === 'overdue' ? 'bg-red-50 border-red-300 text-red-700' : ''}`}
        >
          Overdue follow-ups
        </Link>
      </div>

      <form className="flex flex-wrap items-center gap-3" method="get">
        {searchParams.view && <input type="hidden" name="view" value={searchParams.view} />}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            name="q"
            defaultValue={searchParams.q}
            placeholder="Search name, phone, enquiry #…"
            className="input pl-9"
          />
        </div>
        <select name="status" defaultValue={searchParams.status ?? ''} className="input w-auto">
          <option value="">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
        <select name="priority" defaultValue={searchParams.priority ?? ''} className="input w-auto">
          <option value="">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
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
                <th className="px-5 py-3">Enquiry #</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Priority</th>
                <th className="px-5 py-3">Assigned</th>
                <th className="px-5 py-3">Follow-up</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(enquiries ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-ink-400">
                    No enquiries match these filters.
                  </td>
                </tr>
              )}
              {(enquiries ?? []).map((e) => {
                const isOverdue = e.next_followup_date && e.next_followup_date < today;
                return (
                  <tr key={e.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
                    <td className="px-5 py-3">
                      <Link href={`/admin/enquiries/${e.id}`} className="font-medium text-ink-800 hover:text-brand-700">
                        {e.enquiry_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-ink-700">{e.customer_name}</p>
                      <p className="text-xs text-ink-400">{e.phone}</p>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={e.priority} />
                    </td>
                    <td className="px-5 py-3 text-ink-500">
                      {(() => {
                        const prof = e.profiles as { full_name: string } | { full_name: string }[] | null;
                        return (Array.isArray(prof) ? prof[0]?.full_name : prof?.full_name) ?? 'Unassigned';
                      })()}
                    </td>
                    <td className={`px-5 py-3 ${isOverdue ? 'font-medium text-red-600' : 'text-ink-500'}`}>
                      {e.next_followup_date ? formatDate(e.next_followup_date) : '—'}
                    </td>
                    <td className="px-5 py-3 text-ink-500">{formatDate(e.created_at)}</td>
                    <td className="px-5 py-3">
                      <EnquiryRowActions id={e.id} />
                    </td>
                  </tr>
                );
              })}
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
