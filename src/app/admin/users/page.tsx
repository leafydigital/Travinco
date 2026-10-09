import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { Suspense } from 'react';

/* ── skeleton ─────────────────────────────────────────────── */
function UsersTableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-ink-50 last:border-0">
          {Array.from({ length: 5 }).map((_, j) => (
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
async function UsersRows() {
  const profile = await requireProfile();
  if (profile.role !== 'super_admin') {
    redirect('/admin?error=forbidden');
  }

  const supabase = await createClient();
  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });

  return (
    <>
      {(users ?? []).map((u) => (
        <tr key={u.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
          <td className="px-5 py-3 font-medium text-ink-800">{u.full_name}</td>
          <td className="px-5 py-3 text-ink-500">{u.email}</td>
          <td className="px-5 py-3 capitalize text-ink-600">{u.role.replace('_', ' ')}</td>
          <td className="px-5 py-3">
            <StatusBadge status={u.is_active ? 'published' : 'draft'} />
          </td>
          <td className="px-5 py-3 text-right">
            <Link href={`/admin/users/${u.id}`} className="text-brand-600 hover:underline">
              Edit
            </Link>
          </td>
        </tr>
      ))}
    </>
  );
}

/* ── page shell (instant) ─────────────────────────────────── */
export default function AdminUsersPage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink-900">Users</h1>
        <Link href="/admin/users/new" className="btn-primary">
          <Plus className="h-4 w-4" /> New user
        </Link>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <Suspense fallback={<UsersTableSkeleton />}>
                <UsersRows />
              </Suspense>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
