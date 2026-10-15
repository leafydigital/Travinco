'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  UserCheck,
  UserX,
  Users as UsersIcon,
  Check,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { setStaffActive, deleteStaffUser, updateStaffRole } from './actions';
import type { Tables } from '@/types/database';

interface UsersTableProps {
  initialUsers: Tables<'profiles'>[];
  currentUserId: string;
  currentUserRole: string;
}

export function UsersTable({
  initialUsers,
  currentUserId,
  currentUserRole,
}: UsersTableProps) {
  const router = useRouter();
  const [users, setUsers] = useState<Tables<'profiles'>[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Deletion modal state
  const [deleteModalUser, setDeleteModalUser] = useState<Tables<'profiles'> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Status toggle pending state (stores id of user currently toggling)
  const [pendingActiveId, setPendingActiveId] = useState<string | null>(null);

  // Synchronize state when server props update
  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  // Filter users
  const filteredUsers = users.filter((u) => {
    const query = searchQuery.toLowerCase().trim();
    const nameMatch = u.full_name?.toLowerCase().includes(query) ?? false;
    const emailMatch = u.email?.toLowerCase().includes(query) ?? false;
    const roleMatch = (u.role_title || u.role)?.toLowerCase().includes(query) ?? false;
    const matchesSearch = !query || nameMatch || emailMatch || roleMatch;

    const matchesRole =
      roleFilter === 'all' ||
      u.role === roleFilter ||
      (u.role_title && u.role_title.toLowerCase() === roleFilter.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && u.is_active) ||
      (statusFilter === 'inactive' && !u.is_active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Handle Active / Deactivate toggle
  async function handleToggleActive(user: Tables<'profiles'>) {
    if (user.id === currentUserId && user.is_active) {
      toast.error('You cannot deactivate your own account.');
      return;
    }

    const nextState = !user.is_active;
    setPendingActiveId(user.id);

    // Optimistic UI update
    setUsers((prev) =>
      prev.map((item) => (item.id === user.id ? { ...item, is_active: nextState } : item))
    );

    try {
      const res = await setStaffActive(user.id, nextState);
      if (res.error) {
        // Revert on failure
        setUsers((prev) =>
          prev.map((item) => (item.id === user.id ? { ...item, is_active: !nextState } : item))
        );
        toast.error(res.error);
      } else {
        toast.success(
          nextState
            ? `Activated ${user.full_name}'s account.`
            : `Deactivated ${user.full_name}'s account.`
        );
        router.refresh();
      }
    } catch {
      setUsers((prev) =>
        prev.map((item) => (item.id === user.id ? { ...item, is_active: !nextState } : item))
      );
      toast.error('An unexpected error occurred while updating status.');
    } finally {
      setPendingActiveId(null);
    }
  }

  // Handle Delete Confirmation
  async function handleConfirmDelete() {
    if (!deleteModalUser) return;
    setIsDeleting(true);

    try {
      const res = await deleteStaffUser(deleteModalUser.id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Deleted staff account ${deleteModalUser.full_name}.`);
        setUsers((prev) => prev.filter((item) => item.id !== deleteModalUser.id));
        setDeleteModalUser(null);
        router.refresh();
      }
    } catch {
      toast.error('Failed to delete staff user.');
    } finally {
      setIsDeleting(false);
    }
  }

  // Quick inline role editing state
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingRoleValue, setEditingRoleValue] = useState('');
  const [isSavingRole, setIsSavingRole] = useState(false);

  async function handleSaveRole(userId: string) {
    const trimmed = editingRoleValue.trim();
    if (!trimmed) {
      toast.error('Role name cannot be empty.');
      return;
    }

    setIsSavingRole(true);
    // Optimistic update
    setUsers((prev) =>
      prev.map((item) => (item.id === userId ? { ...item, role_title: trimmed } : item))
    );

    try {
      const res = await updateStaffRole(userId, trimmed);
      if (res.error) {
        toast.error(res.error);
        router.refresh();
      } else {
        toast.success(`Updated role designation to "${trimmed}".`);
        setEditingRoleId(null);
        router.refresh();
      }
    } catch {
      toast.error('Could not update role designation.');
    } finally {
      setIsSavingRole(false);
    }
  }

  // Get distinct role titles for filter dropdown
  const uniqueRoles = Array.from(
    new Set(
      users
        .map((u) => u.role_title || (u.role === 'super_admin' ? 'Super Admin' : u.role === 'admin' ? 'Admin' : 'Staff'))
        .filter(Boolean)
    )
  );

  return (
    <div className="space-y-4">
      {/* ── Top Filters Bar ── */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or role…"
              className="input pl-9 h-10 w-full text-sm"
            />
          </div>

          {/* Role & Status Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="input h-10 min-w-[120px] text-xs py-1.5 px-3 bg-white"
            >
              <option value="all">All Roles</option>
              {uniqueRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input h-10 min-w-[120px] text-xs py-1.5 px-3 bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active only</option>
              <option value="inactive">Deactivated only</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Users Table Card ── */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm text-left">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wider text-ink-500 font-semibold">
                <th className="px-5 py-3.5">Staff Member</th>
                <th className="px-5 py-3.5">Role / Designation</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Joined</th>
                <th className="px-5 py-3.5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-ink-400">
                    <UsersIcon className="mx-auto h-8 w-8 text-ink-300 stroke-[1.5] mb-2" />
                    <p className="font-medium text-ink-700">No staff members found</p>
                    <p className="text-xs text-ink-400 mt-0.5">
                      {searchQuery
                        ? 'Try clearing your search query or filters.'
                        : 'Create your first staff user using the "New user" button above.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSelf = u.id === currentUserId;
                  const isSuperAdmin = u.role === 'super_admin';
                  const isPending = pendingActiveId === u.id;
                  const roleLabel = u.role_title
                    ? u.role_title
                    : u.role === 'super_admin'
                    ? 'Super Admin'
                    : u.role === 'admin'
                    ? 'Admin'
                    : 'Staff';

                  return (
                    <tr
                      key={u.id}
                      className="transition-colors hover:bg-ink-50/40"
                    >
                      {/* Name & Email */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center font-bold text-xs ${
                              u.role === 'super_admin' || u.role === 'admin'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-brand-100 text-brand-700'
                            }`}
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
                              <span className="font-semibold text-ink-900 truncate">
                                {u.full_name}
                              </span>
                              {isSelf && (
                                <span className="rounded bg-brand-50 border border-brand-200 px-1.5 py-0.2 text-[10px] font-semibold text-brand-700">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-ink-400 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Custom Role */}
                      <td className="px-5 py-3.5">
                        {editingRoleId === u.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingRoleValue}
                              onChange={(e) => setEditingRoleValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRole(u.id);
                                if (e.key === 'Escape') setEditingRoleId(null);
                              }}
                              autoFocus
                              placeholder="e.g. tester"
                              className="input text-xs py-1 px-2 h-7 w-32 font-medium"
                              disabled={isSavingRole}
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveRole(u.id)}
                              disabled={isSavingRole}
                              className="h-7 w-7 rounded bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 transition-colors shadow-2xs"
                              title="Save role"
                            >
                              {isSavingRole ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingRoleId(null)}
                              disabled={isSavingRole}
                              className="h-7 w-7 rounded border border-ink-200 bg-white text-ink-600 flex items-center justify-center hover:bg-ink-50 transition-colors shadow-2xs"
                              title="Cancel"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 group">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${
                                u.role === 'super_admin' || u.role === 'admin'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : 'bg-brand-50 text-brand-700 border border-brand-200'
                              }`}
                            >
                              {roleLabel}
                            </span>
                            {!isSelf && !isSuperAdmin && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRoleId(u.id);
                                  setEditingRoleValue(u.role_title || roleLabel);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-ink-400 hover:text-ink-700 rounded hover:bg-ink-100"
                                title="Quick edit role name"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Active Status Badge */}
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            u.is_active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-ink-100 text-ink-500 border border-ink-200'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              u.is_active ? 'bg-emerald-500' : 'bg-ink-400'
                            }`}
                          />
                          {u.is_active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>

                      {/* Joined Date */}
                      <td className="px-5 py-3.5 text-xs text-ink-400">
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>

                      {/* ── Actions: Active/Deactivate, Edit, Delete ── */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Active / Deactivate Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleActive(u)}
                            disabled={isSelf || isPending}
                            title={
                              isSelf
                                ? 'You cannot deactivate your own account'
                                : u.is_active
                                ? 'Deactivate user'
                                : 'Activate user'
                            }
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                              isSelf
                                ? 'cursor-not-allowed border-ink-200 bg-ink-50 text-ink-300'
                                : u.is_active
                                ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : u.is_active ? (
                              <>
                                <PowerOff className="h-3 w-3 text-amber-600" />
                                <span>Deactivate</span>
                              </>
                            ) : (
                              <>
                                <Power className="h-3 w-3 text-emerald-600" />
                                <span>Activate</span>
                              </>
                            )}
                          </button>

                          {/* Edit Button */}
                          <Link
                            href={`/travinco_dashboard/users/${u.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>Edit</span>
                          </Link>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => setDeleteModalUser(u)}
                            disabled={isSelf || isSuperAdmin}
                            title={
                              isSelf
                                ? 'You cannot delete yourself'
                                : isSuperAdmin
                                ? 'Super Admin cannot be deleted'
                                : 'Delete user'
                            }
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                              isSelf || isSuperAdmin
                                ? 'cursor-not-allowed border-ink-100 bg-ink-50 text-ink-300'
                                : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300'
                            }`}
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Delete</span>
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

      {/* ── Confirmation Modal for Deletion ── */}
      {deleteModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="card max-w-md w-full p-6 space-y-4 shadow-xl border-red-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-ink-900">
                  Delete Staff Account
                </h3>
                <p className="text-xs text-ink-500">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p className="text-sm text-ink-600 leading-relaxed">
              Are you sure you want to permanently delete the account for{' '}
              <strong className="text-ink-900">{deleteModalUser.full_name}</strong>{' '}
              ({deleteModalUser.email})? All permissions and profile details will be removed.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-ink-100">
              <button
                type="button"
                onClick={() => setDeleteModalUser(null)}
                disabled={isDeleting}
                className="btn-outline text-xs px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="btn-danger text-xs px-4 py-2 flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
