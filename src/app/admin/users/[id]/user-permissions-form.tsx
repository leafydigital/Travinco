'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { updateStaffRole, setStaffActive, setStaffPermissions } from '../actions';
import type { Tables } from '@/types/database';

const MODULES = [
  { key: 'packages', label: 'Packages' },
  { key: 'destinations', label: 'Destinations' },
  { key: 'enquiries', label: 'Enquiries' },
  { key: 'offers', label: 'Special offers' },
  { key: 'gallery', label: 'Gallery' },
  { key: 'blog', label: 'Blog' },
  { key: 'settings', label: 'Settings' },
  { key: 'users', label: 'Users' },
] as const;

type PermissionState = Record<string, { can_view: boolean; can_edit: boolean }>;

export function UserPermissionsForm({
  userId,
  currentRole,
  isActive,
  isSelf,
  existingPermissions,
}: {
  userId: string;
  currentRole: string;
  isActive: boolean;
  isSelf: boolean;
  existingPermissions: Tables<'staff_permissions'>[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState(currentRole);
  const [active, setActive] = useState(isActive);

  const initialPermissions: PermissionState = {};
  for (const m of MODULES) {
    const existing = existingPermissions.find((p) => p.module === m.key);
    initialPermissions[m.key] = existing
      ? { can_view: existing.can_view, can_edit: existing.can_edit }
      : { can_view: false, can_edit: false };
  }
  const [permissions, setPermissions] = useState<PermissionState>(initialPermissions);

  function togglePermission(moduleKey: string, field: 'can_view' | 'can_edit', value: boolean) {
    setPermissions((prev) => {
      const current = prev[moduleKey] ?? { can_view: false, can_edit: false };
      const next =
        field === 'can_view'
          ? { can_view: value, can_edit: current.can_edit }
          : { can_view: current.can_view, can_edit: value };
      // Editing implies viewing — you can't grant edit access without view.
      if (field === 'can_edit' && value) next.can_view = true;
      if (field === 'can_view' && !value) next.can_edit = false;
      return { ...prev, [moduleKey]: next };
    });
  }

  function handleRoleChange(newRole: string) {
    setRole(newRole);
    startTransition(async () => {
      const result = await updateStaffRole(userId, newRole);
      if (result.error) toast.error(result.error);
      else toast.success('Role updated');
    });
  }

  function handleActiveToggle() {
    const next = !active;
    setActive(next);
    startTransition(async () => {
      const result = await setStaffActive(userId, next);
      if (result.error) {
        toast.error(result.error);
        setActive(!next);
      } else {
        toast.success(next ? 'User activated' : 'User deactivated');
      }
    });
  }

  function handleSavePermissions() {
    startTransition(async () => {
      const result = await setStaffPermissions(userId, permissions);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Permissions saved');
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="card space-y-4 p-5">
        <div>
          <label className="label">Role</label>
          <select
            value={role}
            onChange={(e) => handleRoleChange(e.target.value)}
            disabled={isSelf || role === 'super_admin'}
            className="input"
          >
            <option value="super_admin">Super admin</option>
            <option value="admin">Admin</option>
            <option value="sales_staff">Sales staff</option>
            <option value="accounts_staff">Accounts staff</option>
          </select>
          {isSelf && (
            <p className="mt-1 text-xs text-ink-400">You can&apos;t change your own role.</p>
          )}
        </div>

        {!isSelf && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-700">Account active</span>
            <button
              type="button"
              onClick={handleActiveToggle}
              disabled={isPending}
              className={active ? 'btn-outline' : 'btn-cta'}
            >
              {active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        )}
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="text-sm font-semibold text-ink-800">Module permissions</h2>
        <p className="text-xs text-ink-400">
          These tick boxes give extra access on top of the role above — leave everything
          unticked to rely on the role&apos;s own default access.
        </p>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="py-2">Module</th>
              <th className="py-2 text-center">Can view</th>
              <th className="py-2 text-center">Can edit</th>
            </tr>
          </thead>
          <tbody>
            {MODULES.map((m) => (
              <tr key={m.key} className="border-t border-ink-50">
                <td className="py-2 text-ink-700">{m.label}</td>
                <td className="py-2 text-center">
                  <input
                    type="checkbox"
                    checked={permissions[m.key]?.can_view ?? false}
                    onChange={(e) => togglePermission(m.key, 'can_view', e.target.checked)}
                    className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                  />
                </td>
                <td className="py-2 text-center">
                  <input
                    type="checkbox"
                    checked={permissions[m.key]?.can_edit ?? false}
                    onChange={(e) => togglePermission(m.key, 'can_edit', e.target.checked)}
                    className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          type="button"
          onClick={handleSavePermissions}
          disabled={isPending}
          className="btn-primary w-full justify-center"
        >
          {isPending ? 'Saving…' : 'Save permissions'}
        </button>
      </div>
    </div>
  );
}
