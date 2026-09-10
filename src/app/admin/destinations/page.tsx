import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { StatusBadge } from '@/components/ui/status-badge';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { DestinationRowActions } from './destination-row-actions';

export default async function AdminDestinationsPage() {
  await requireProfile();
  const supabase = await createClient();
  const { data: destinations } = await supabase.from('destinations').select('*').order('sort_order');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink-900">Destinations</h1>
        <Link href="/admin/destinations/new" className="btn-primary">
          <Plus className="h-4 w-4" /> New destination
        </Link>
      </div>

      <div className="card overflow-hidden">
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
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <DestinationRowActions id={d.id} status={d.status} />
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
