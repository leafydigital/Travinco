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
  RefreshCw,
  X,
  CheckCircle2,
  Check,
  Circle,
} from 'lucide-react';
import { toast, confirmAlert } from '@/lib/admin-alert';
import { formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { PASSWORD_RULES, generateTempPassword, passwordMeetsRules } from '@/lib/temp-password';
import { ModalPortal } from '@/components/ui/modal-portal';
import { setStaffActive, deleteStaffUser, resetStaffTempPassword } from './actions';
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
  const [resetUser, setResetUser] = useState<Tables<'profiles'> | null>(null);

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

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      roleLabel(u).toLowerCase().includes(q);
    const matchesRole = roleFilter === 'all' || roleLabel(u) === roleFilter;
    const matchesStatus =
      statusFilter === 'all' || (statusFilter === 'active' && u.is_active) || (statusFilter === 'inactive' && !u.is_active);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const roleFilterOptions = Array.from(new Set(users.map(roleLabel))).sort();

  /** Admins can't manage the Super Admin, and only the Super Admin manages other admins. */
  const canManage = (u: Tables<'profiles'>) =>
    u.role !== 'super_admin' && !(u.role === 'admin' && currentUserRole !== 'super_admin');

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
      title: `Delete ${user.full_name}?`,
      text: `${user.email} will no longer be able to sign in.`,
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
    void toast.success('User deleted successfully');
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
      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or role…"
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
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input h-10 min-w-[120px] bg-white px-3 py-1.5 text-xs"
            >
              <option value="all">All statuses</option>
              <option value="active">Active only</option>
              <option value="inactive">Deactivated only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-xs font-semibold uppercase tracking-wider text-ink-500">
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Temporary password</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Joined</th>
                <th className="whitespace-nowrap px-5 py-3.5 text-right">Actions</th>
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
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
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
                            <p className="truncate text-xs text-ink-400">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
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

                      <td className="px-5 py-3.5">
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
                          <span className="text-xs text-ink-400">—</span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-xs text-emerald-700"
                            title="The user has set their own password. It is private and can't be shown."
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Changed by user
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
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

                      <td className="px-5 py-3.5 text-xs text-ink-400">{formatDate(u.created_at)}</td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(u)}
                            disabled={isSelf || !manageable || pendingActiveId === u.id}
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
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>

                          {manageable ? (
                            <Link
                              href={`/travinco_dashboard/users/${u.id}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                            >
                              <Pencil className="h-3 w-3" /> Edit
                            </Link>
                          ) : (
                            <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg border border-ink-100 bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-300">
                              <Pencil className="h-3 w-3" /> Edit
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => setResetUser(u)}
                            disabled={!manageable || isSelf || tempPasswords === null}
                            title={isSelf ? 'Use “Change password” in the sidebar for your own account' : 'Set a new temporary password'}
                            className="inline-flex items-center gap-1 rounded-lg border border-ocean-200 bg-ocean-50 px-2.5 py-1 text-xs font-medium text-ocean-700 transition-colors hover:bg-ocean-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <KeyRound className="h-3 w-3" /> Reset password
                          </button>

                          <button
                            type="button"
                            data-no-confirm-save="true"
                            onClick={() => handleDelete(u)}
                            disabled={isSelf || !manageable || deletingId === u.id}
                            title={isSelf ? 'You cannot delete yourself' : 'Delete user'}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {deletingId === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            Delete
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

      {resetUser && (
        <ResetPasswordDialog
          user={resetUser}
          onClose={() => setResetUser(null)}
          onDone={() => {
            setRevealed((prev) => new Set(prev).add(resetUser.id));
            setResetUser(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ResetPasswordDialog({
  user,
  onClose,
  onDone,
}: {
  user: Tables<'profiles'>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState(() => generateTempPassword());
  const [saving, setSaving] = useState(false);
  const valid = passwordMeetsRules(password);

  async function handleReset() {
    if (!valid || saving) return;
    setSaving(true);
    const res = await resetStaffTempPassword(user.id, password).catch(() => ({ error: 'Could not reset the password.' }));
    setSaving(false);
    if ('error' in res && res.error) return void toast.error(res.error);
    onDone();
    void toast.success('Password reset successfully', {
      description: `Share the new temporary password with ${user.full_name}. It stays visible on this page until they change it.`,
    });
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-ink-100 bg-white p-5 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-ink-900">Reset password</h3>
              <p className="text-xs text-ink-500">
                New temporary password for <b>{user.full_name}</b> ({user.email})
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1 text-ink-400 hover:bg-ink-100" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <div className="flex gap-2">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value.replace(/\s/g, ''))}
                maxLength={72}
                className="input flex-1 font-mono"
                aria-label="Temporary password"
              />
              <button
                type="button"
                data-no-confirm-save="true"
                onClick={() => setPassword(generateTempPassword())}
                className="btn-outline px-3"
                title="Generate a new password"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
              {PASSWORD_RULES.map((r) => {
                const ok = r.test(password);
                return (
                  <li key={r.key} className={cn('flex items-center gap-1.5', ok ? 'text-emerald-700' : 'text-ink-400')}>
                    {ok ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                    {r.label}
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[11px] text-ink-400">
              The user signs in with this password and can change it from “Change password”. Once they do, it&apos;s no
              longer shown here.
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t border-ink-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={!valid || saving}
              data-confirm-save="true"
              data-confirm-label="Reset password"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
              {saving ? 'Resetting...' : 'Reset password'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
