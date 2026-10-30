'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Loader2,
  KeyRound,
  Users as UsersIcon,
  Eye,
  EyeOff,
  Copy,
} from 'lucide-react';
import { toast, confirmAlert } from '@/lib/admin-alert';
import { formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { setStaffActive, deleteStaffUser } from './actions';
import type { Tables } from '@/types/database';

export type RoleOption = { id: string; name: string; pages: string[]; isSystem: boolean };

interface UsersTableProps {
  initialUsers: Tables<'profiles'>[];
  currentUserId: string;
  currentUserRole: string;
  roles: RoleOption[];
  /** profile id → temporary password; null when the table isn't set up yet */
  tempPasswords: Record<string, { password: string; setAt: string }> | null;
}

export function UsersTable({ initialUsers, currentUserId, currentUserRole, roles, tempPasswords }: UsersTableProps) {
  const router = useRouter();
  const [users, setUsers] = useState<Tables<'profiles'>[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pendingActiveId, setPendingActiveId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  const roleById = new Map(roles.map((r) => [r.id, r]));
  const roleLabel = (u: Tables<'profiles'>) => {
    const role = u.role_id ? roleById.get(u.role_id) : undefined;
    if (role) return role.name;
    if (u.role === 'super_admin') return 'Super Admin';
    if (u.role === 'admin') return 'Admin';
    return u.role_title || 'No role';
  };
  const isAdminUser = (u: Tables<'profiles'>) =>
    u.role === 'super_admin' || u.role === 'admin' || Boolean(u.role_id && roleById.get(u.role_id)?.isSystem);

  // Users with the legacy 'admin' role but no role_id belong to the built-in Admin role
  const systemRole = roles.find((r) => r.isSystem);
  const roleKey = (u: Tables<'profiles'>): string => {
    if (u.role === 'super_admin') return 'super_admin';
    if (u.role_id && roleById.has(u.role_id)) return u.role_id;
    if (u.role === 'admin') return systemRole?.id ?? 'admin';
    return 'none';
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      roleLabel(u).toLowerCase().includes(q);
    const matchesRole = roleFilter === 'all' || roleKey(u) === roleFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && u.is_active) ||
      (statusFilter === 'inactive' && !u.is_active);
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Every defined role is listed (even with no users yet), with how many users have it
  const roleCounts = users.reduce<Record<string, number>>((acc, u) => {
    const k = roleKey(u);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const roleFilterOptions: { value: string; label: string }[] = [
    ...(roleCounts.super_admin ? [{ value: 'super_admin', label: 'Super Admin' }] : []),
    ...(!systemRole && roleCounts.admin ? [{ value: 'admin', label: 'Admin' }] : []),
    ...roles.map((r) => ({ value: r.id, label: r.name })),
    ...(roleCounts.none ? [{ value: 'none', label: 'No role' }] : []),
  ].map((o) => ({ ...o, label: `${o.label} (${roleCounts[o.value] ?? 0})` }));

  /** Edit: your own account, any account for the Super Admin, otherwise staff (not admins). */
  const canManage = (u: Tables<'profiles'>) =>
    u.id === currentUserId ||
    currentUserRole === 'super_admin' ||
    (u.role !== 'super_admin' && u.role !== 'admin');
  /** Deactivate / delete: never yourself or a Super Admin account. */
  const canRemove = (u: Tables<'profiles'>) => u.id !== currentUserId && u.role !== 'super_admin' && canManage(u);

  async function handleToggleActive(user: Tables<'profiles'>) {
    if (user.id === currentUserId && user.is_active) return void toast.error('You cannot deactivate your own account.');
    const nextState = !user.is_active;
    setPendingActiveId(user.id);
    setUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, is_active: nextState } : item)));
    const res = await setStaffActive(user.id, nextState).catch(() => ({ error: 'Could not update status.' }));
    setPendingActiveId(null);
    if ('error' in res && res.error) {
      setUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, is_active: !nextState } : item)));
      return void toast.error(res.error);
    }
    router.refresh();
    void toast.success(nextState ? `${user.full_name} activated` : `${user.full_name} deactivated`);
  }

  async function handleDelete(user: Tables<'profiles'>) {
    const ok = await confirmAlert({
      title: `Delete ${user.full_name} permanently?`,
      text: `${user.email} is saved to the Google Sheet "Users" tab, then removed from the system. Their sign-in stops working and the email can be used for a new user.`,
      confirmText: 'Delete',
      icon: 'warning',
      danger: true,
    });
    if (!ok) return;
    setDeletingId(user.id);
    const res = await deleteStaffUser(user.id).catch(() => ({ error: 'Failed to delete the user.' }));
    setDeletingId(null);
    if ('error' in res && res.error) return void toast.error(res.error);
    setUsers((prev) => prev.filter((item) => item.id !== user.id));
    router.refresh();
    void toast.success('User deleted permanently');
  }

  async function copyPassword(password: string) {
    try {
      await navigator.clipboard.writeText(password);
      void toast.success('Password copied');
    } catch {
      void toast.error('Could not copy — please select and copy it manually.');
    }
  }

  return (
    <div className="space-y-4">
      {tempPasswords === null && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Passwords can&apos;t be shown because the <code>staff_temp_passwords</code> table is missing. Run{' '}
          <code>supabase/roles_and_users_migration.sql</code> in the Supabase SQL editor.
        </div>
      )}

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, username, email, phone or role…"
              className="input h-10 w-full pl-9 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="input h-10 min-w-[130px] bg-white px-3 py-1.5 text-xs"
            >
              <option value="all">All roles</option>
              {roleFilterOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input h-10 min-w-[120px] bg-white px-3 py-1.5 text-xs"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Deactivated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div>
          <table className="w-full table-fixed text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-xs font-semibold uppercase tracking-wider text-ink-500">
                <th className="w-[30%] px-3 py-3.5 lg:px-4">User</th>
                <th className="hidden px-3 py-3.5 md:table-cell lg:px-4">Role</th>
                <th className="hidden px-3 py-3.5 lg:table-cell lg:px-4">Password</th>
                <th className="px-3 py-3.5 lg:px-4">Status</th>
                <th className="hidden px-3 py-3.5 xl:table-cell xl:px-4">Joined</th>
                <th className="w-[7.5rem] px-3 py-3.5 text-right sm:w-[10rem] xl:w-[18rem] lg:px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-ink-400">
                    <UsersIcon className="mx-auto mb-2 h-8 w-8 stroke-[1.5] text-ink-300" />
                    <p className="font-medium text-ink-700">No users found</p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {searchQuery ? 'Try clearing your search or filters.' : 'Create your first user with the "New user" button.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSelf = u.id === currentUserId;
                  const manageable = canManage(u);
                  const temp = tempPasswords?.[u.id];
                  const shown = revealed.has(u.id);
                  return (
                    <tr key={u.id} className="transition-colors hover:bg-ink-50/40">
                      <td className="px-3 py-3.5 lg:px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:flex',
                              isAdminUser(u) ? 'bg-purple-100 text-purple-700' : 'bg-brand-100 text-brand-700'
                            )}
                          >
                            {u.full_name
                              ?.split(' ')
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-semibold text-ink-900">{u.full_name}</span>
                              {isSelf && (
                                <span className="rounded border border-brand-200 bg-brand-50 px-1.5 text-[10px] font-semibold text-brand-700">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="truncate text-xs text-ink-400">
                              {u.username ? `@${u.username} · ` : ''}
                              {u.email}
                            </p>
                            {u.phone && <p className="truncate text-xs text-ink-400">{u.phone}</p>}
                          </div>
                        </div>
                      </td>

                      <td className="hidden px-3 py-3.5 md:table-cell lg:px-4">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold',
                            isAdminUser(u)
                              ? 'border-purple-200 bg-purple-50 text-purple-700'
                              : u.role_id
                                ? 'border-brand-200 bg-brand-50 text-brand-700'
                                : 'border-amber-200 bg-amber-50 text-amber-700'
                          )}
                        >
                          {roleLabel(u)}
                        </span>
                      </td>

                      <td className="hidden px-3 py-3.5 lg:table-cell lg:px-4">
                        {temp ? (
                          <div className="flex items-center gap-1">
                            <code className="rounded bg-ink-100 px-2 py-0.5 font-mono text-xs text-ink-800">
                              {shown ? temp.password : '••••••••••'}
                            </code>
                            <button
                              type="button"
                              onClick={() =>
                                setRevealed((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(u.id)) next.delete(u.id);
                                  else next.add(u.id);
                                  return next;
                                })
                              }
                              className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                              aria-label={shown ? 'Hide password' : 'Show password'}
                              title={shown ? 'Hide' : 'Show'}
                            >
                              {shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => copyPassword(temp.password)}
                              className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                              aria-label="Copy password"
                              title="Copy"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : tempPasswords === null ? (
                          <span className="text-xs text-ink-400" title="Password storage is not set up">—</span>
                        ) : isSelf ? (
                          <span className="text-xs text-ink-400">Your own password</span>
                        ) : (
                          <Link
                            href={`/travinco_dashboard/users/${u.id}`}
                            className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-brand-700 hover:underline"
                            title="No admin-set password is stored (user created before this feature, or they changed it themselves). Open Edit to set a new one."
                            >
                              <KeyRound className="h-3.5 w-3.5" /> Not set — set in Edit
                            </Link>
                        )}
                      </td>

                      <td className="px-3 py-3.5 lg:px-4">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                              u.is_active
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-ink-200 bg-ink-100 text-ink-500'
                            )}
                          >
                            <span className={cn('h-1.5 w-1.5 rounded-full', u.is_active ? 'bg-emerald-500' : 'bg-ink-400')} />
                            {u.is_active ? 'Active' : 'Deactivated'}
                          </span>
                      </td>

                      <td className="hidden px-3 py-3.5 text-xs text-ink-400 xl:table-cell xl:px-4">{formatDate(u.created_at)}</td>

                      <td className="px-3 py-3.5 text-right lg:px-4">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(u)}
                              disabled={!canRemove(u) || pendingActiveId === u.id}
                              title={isSelf ? 'You cannot deactivate your own account' : u.is_active ? 'Deactivate user' : 'Activate user'}
                              className={cn(
                                'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                                u.is_active
                                  ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              )}
                            >
                              {pendingActiveId === u.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : u.is_active ? (
                                <PowerOff className="h-3 w-3" />
                              ) : (
                                <Power className="h-3 w-3" />
                              )}
                              <span className="hidden xl:inline">{u.is_active ? 'Deactivate' : 'Activate'}</span>
                            </button>

                            {manageable ? (
                              <Link
                                href={`/travinco_dashboard/users/${u.id}`}
                                title="Edit user"
                                className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                              >
                                <Pencil className="h-3 w-3" /> <span className="hidden xl:inline">Edit</span>
                              </Link>
                            ) : (
                              <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg border border-ink-100 bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-300">
                                <Pencil className="h-3 w-3" /> <span className="hidden xl:inline">Edit</span>
                              </span>
                            )}

                            <button
                              type="button"
                              data-no-confirm-save="true"
                              onClick={() => handleDelete(u)}
                              disabled={!canRemove(u) || deletingId === u.id}
                              title={isSelf ? 'You cannot delete yourself' : 'Delete user'}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {deletingId === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                              <span className="hidden xl:inline">Delete</span>
                            </button>
                          </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
