'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Lock,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import { toast, confirmAlert } from '@/lib/admin-alert';
import { ModalPortal } from '@/components/ui/modal-portal';
import { cn } from '@/lib/utils/cn';
import { ASSIGNABLE_PAGE_GROUPS, PAGE_LABELS, validateRoleName } from '@/lib/staff-roles';
import { createRole, updateRole, deleteRole } from './actions';

export type RoleRow = {
  id: string;
  name: string;
  pages: string[];
  isSystem: boolean;
  userCount: number;
  updatedAt: string;
};

type Draft = { id: string | null; name: string; pages: Set<string> };

export function RolesClient({ roles }: { roles: RoleRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openCreate = () => {
    setNameError(null);
    setDraft({ id: null, name: '', pages: new Set(['dashboard']) });
  };
  const openEdit = (role: RoleRow) => {
    setNameError(null);
    setDraft({ id: role.id, name: role.name, pages: new Set(role.pages) });
  };

  const togglePage = (key: string) =>
    setDraft((d) => {
      if (!d) return d;
      const pages = new Set(d.pages);
      if (pages.has(key)) pages.delete(key);
      else pages.add(key);
      return { ...d, pages };
    });

  const toggleGroup = (keys: string[], on: boolean) =>
    setDraft((d) => {
      if (!d) return d;
      const pages = new Set(d.pages);
      keys.forEach((k) => (on ? pages.add(k) : pages.delete(k)));
      return { ...d, pages };
    });

  function handleSave() {
    if (!draft) return;
    const err = validateRoleName(draft.name);
    setNameError(err);
    if (err) return void toast.error(err);
    if (draft.pages.size === 0) return void toast.error('Select at least one page this role can access.');

    const payload = { name: draft.name, pages: Array.from(draft.pages) };
    const isNew = !draft.id;
    startSaving(async () => {
      const res = isNew ? await createRole(payload) : await updateRole(draft.id!, payload);
      if (res.error) return void toast.error(res.error);
      setDraft(null);
      router.refresh();
      void toast.success(isNew ? 'Role created successfully' : 'Role updated successfully', {
        description: isNew
          ? `"${payload.name.trim()}" can now be assigned to users.`
          : 'Users with this role now see the updated pages.',
      });
    });
  }

  async function handleDelete(role: RoleRow) {
    if (role.userCount > 0) {
      return void toast.warning('This role is in use', {
        description: `${role.userCount} user${role.userCount === 1 ? ' has' : 's have'} the "${role.name}" role. Move them to another role on the Users page first.`,
      });
    }
    const ok = await confirmAlert({
      title: `Delete "${role.name}"?`,
      text: 'This role will be removed permanently.',
      confirmText: 'Delete',
      icon: 'warning',
      danger: true,
    });
    if (!ok) return;
    setDeletingId(role.id);
    const res = await deleteRole(role.id);
    setDeletingId(null);
    if (res.error) return void toast.error(res.error);
    router.refresh();
    void toast.success('Role deleted successfully');
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-900">Roles</h1>
          <p className="mt-0.5 text-xs text-ink-500">
            Create roles and choose the pages each role can open. Users get their access from their role.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary">
          <Plus className="h-4 w-4" /> New role
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-xs font-semibold uppercase tracking-wider text-ink-500">
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Pages</th>
                <th className="px-5 py-3.5">Users</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {roles.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-ink-400">
                    <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-ink-300" />
                    <p className="font-medium text-ink-700">No roles yet</p>
                    <p className="text-xs">Create your first role with the “New role” button.</p>
                  </td>
                </tr>
              )}
              {roles.map((role) => (
                <tr key={role.id} className="align-top transition-colors hover:bg-ink-50/40">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold',
                          role.isSystem
                            ? 'border-purple-200 bg-purple-50 text-purple-700'
                            : 'border-brand-200 bg-brand-50 text-brand-700'
                        )}
                      >
                        {role.isSystem && <Lock className="h-3 w-3" />}
                        {role.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {role.isSystem ? (
                      <span className="text-xs font-medium text-purple-700">All pages (including Roles & Users)</span>
                    ) : (
                      <div className="flex max-w-xl flex-wrap gap-1">
                        {role.pages.map((key) => (
                          <span key={key} className="rounded bg-ink-100 px-1.5 py-0.5 text-[11px] text-ink-700">
                            {PAGE_LABELS[key] ?? key}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1 text-xs text-ink-600">
                      <UsersIcon className="h-3.5 w-3.5 text-ink-400" />
                      {role.userCount}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {role.isSystem ? (
                      <span className="text-xs text-ink-400">Built-in</span>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(role)}
                          className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button
                          type="button"
                          data-no-confirm-save="true"
                          onClick={() => handleDelete(role)}
                          disabled={deletingId === role.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-100 disabled:opacity-50"
                        >
                          {deletingId === role.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {draft && (
        <RoleFormModal
          draft={draft}
          nameError={nameError}
          isSaving={isSaving}
          onName={(name) => {
            setDraft((d) => (d ? { ...d, name } : d));
            if (nameError) setNameError(validateRoleName(name));
          }}
          onNameBlur={() => setNameError(validateRoleName(draft.name))}
          onTogglePage={togglePage}
          onToggleGroup={toggleGroup}
          onCancel={() => setDraft(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function RoleFormModal({
  draft,
  nameError,
  isSaving,
  onName,
  onNameBlur,
  onTogglePage,
  onToggleGroup,
  onCancel,
  onSave,
}: {
  draft: Draft;
  nameError: string | null;
  isSaving: boolean;
  onName: (v: string) => void;
  onNameBlur: () => void;
  onTogglePage: (key: string) => void;
  onToggleGroup: (keys: string[], on: boolean) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const total = useMemo(() => ASSIGNABLE_PAGE_GROUPS.reduce((n, g) => n + g.pages.length, 0), []);
  const isNew = !draft.id;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4">
        <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-ink-100 bg-white shadow-xl">
          {/* Header with actions on top */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-3.5">
            <div>
              <h2 className="text-lg font-semibold text-ink-900">{isNew ? 'New role' : 'Edit role'}</h2>
              <p className="text-xs text-ink-500">
                {draft.pages.size} of {total} pages selected
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                data-confirm-save="true"
                data-confirm-label={isNew ? 'Create role' : 'Update'}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {isSaving ? 'Saving....' : isNew ? 'Create role' : 'Update'}
              </button>
            </div>
          </div>

          <div className="space-y-5 overflow-y-auto p-5">
            <div className="max-w-sm">
              <label htmlFor="role-name" className="mb-1 block text-sm font-medium text-ink-700">
                Role name <span className="text-red-500">*</span>
              </label>
              <input
                id="role-name"
                autoFocus
                maxLength={50}
                value={draft.name}
                onChange={(e) => onName(e.target.value.replace(/\d/g, ''))}
                onBlur={onNameBlur}
                aria-invalid={Boolean(nameError)}
                placeholder="e.g. Sales Executive"
                className={cn('input', nameError && 'border-red-400 focus:border-red-500')}
              />
              {nameError && <p className="field-error">{nameError}</p>}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-ink-700">
                Pages this role can access <span className="text-red-500">*</span>
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {ASSIGNABLE_PAGE_GROUPS.map((group) => {
                  const keys = group.pages.map((p) => p.key);
                  const allOn = keys.every((k) => draft.pages.has(k));
                  return (
                    <div key={group.category} className="rounded-xl border border-ink-100 bg-ink-50/40 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{group.category}</p>
                        <button
                          type="button"
                          data-no-confirm-save="true"
                          onClick={() => onToggleGroup(keys, !allOn)}
                          className="text-[11px] font-medium text-brand-700 hover:underline"
                        >
                          {allOn ? 'Clear all' : 'Select all'}
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {group.pages.map((page) => (
                          <label
                            key={page.key}
                            className={cn(
                              'flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 transition',
                              draft.pages.has(page.key) ? 'bg-white shadow-2xs' : 'hover:bg-white/70'
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={draft.pages.has(page.key)}
                              onChange={() => onTogglePage(page.key)}
                              className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                            />
                            <span>
                              <span className="block text-sm font-medium text-ink-800">{page.label}</span>
                              <span className="block text-[11px] leading-snug text-ink-400">{page.description}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-ink-400">
                Roles and Users pages are reserved for the built-in Admin role.
              </p>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
