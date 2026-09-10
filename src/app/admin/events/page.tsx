import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate } from '@/lib/utils/format';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { EventRowActions } from './event-row-actions';

export default async function AdminEventsPage() {
  await requireProfile();
  const supabase = await createClient();
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink-900">Events</h1>
        <Link href="/admin/events/new" className="btn-primary">
          <Plus className="h-4 w-4" /> New event
        </Link>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(events ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-ink-400">
                    No events yet.
                  </td>
                </tr>
              )}
              {(events ?? []).map((e) => (
                <tr key={e.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
                  <td className="px-5 py-3">
                    <Link href={`/admin/events/${e.id}`} className="font-medium text-ink-800 hover:text-brand-700">
                      {e.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-ink-500">{formatDate(e.event_date)}</td>
                  <td className="px-5 py-3 text-ink-500">{e.location ?? '—'}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <EventRowActions id={e.id} status={e.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
