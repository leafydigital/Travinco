'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CheckCircle2, Circle, Eye, EyeOff, Loader2, Lock, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { toast } from '@/lib/admin-alert';
import { cn } from '@/lib/utils/cn';
import { validateFullName, validateEmailAddress } from '@/lib/validations/contact-rules';
import { PASSWORD_RULES, generateTempPassword, passwordMeetsRules } from '@/lib/temp-password';
import { ASSIGNABLE_PAGE_GROUPS } from '@/lib/staff-roles';
import { createStaffUser, updateStaffUser } from './actions';
import type { RoleOption } from './users-table';

type Props =
  | { mode: 'create'; roles: RoleOption[] }
  | {
      mode: 'edit';
      roles: RoleOption[];
      userId: string;
      initial: { full_name: string; email: string; role_id: string | null };
      /** Editing your own account: role can't be changed */
      isSelf?: boolean;
    };

/** Read-only list of the pages a role allows, grouped like the sidebar. */
function RolePagesPreview({ role }: { role: RoleOption | undefined }) {
  if (!role) {
    return (
      <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50/40 p-4 text-center text-sm text-ink-400">
        Choose a role to see the pages this user can access.
      </div>
    );
  }
  if (role.isSystem) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-800">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        Admin — full access to every page, including Roles and Users.
      </div>
    );
  }
  const allowed = new Set(role.pages);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ASSIGNABLE_PAGE_GROUPS.map((group) => {
        const pages = group.pages.filter((p) => allowed.has(p.key));
        if (pages.length === 0) return null;
        return (
          <div key={group.category} className="rounded-xl border border-ink-100 bg-ink-50/40 p-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">{group.category}</p>
            <ul className="space-y-1">
              {pages.map((p) => (
                <li key={p.key} className="flex items-center gap-1.5 text-sm text-ink-800">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  {p.label}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function UserForm(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === 'edit';
  const [isPending, startTransition] = useTransition();

  const [fullName, setFullName] = useState(isEdit ? props.initial.full_name : '');
  const [email, setEmail] = useState(isEdit ? props.initial.email : '');
  const [roleId, setRoleId] = useState(isEdit ? props.initial.role_id ?? '' : '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const selectedRole = useMemo(() => props.roles.find((r) => r.id === roleId), [props.roles, roleId]);
  const isSelf = isEdit && Boolean(props.isSelf);

  function validate(): string | null {
    const next: Record<string, string | null> = {
      full_name: validateFullName(fullName),
      email: isEdit ? null : validateEmailAddress(email),
      role: roleId ? null : 'Please choose a role',
      password: isEdit ? null : passwordMeetsRules(password) ? null : 'Password does not meet all the rules',
    };
    setErrors(next);
    return Object.values(next).find(Boolean) ?? null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) return void toast.error(err);

    startTransition(async () => {
      const res = isEdit
        ? await updateStaffUser(props.userId, { full_name: fullName.trim(), role_id: roleId })
        : await createStaffUser({ full_name: fullName.trim(), email: email.trim(), role_id: roleId, password });
      if (res.error) return void toast.error(res.error);
      await toast.success(isEdit ? 'Updated successfully' : 'User created successfully', {
        description: isEdit
          ? undefined
          : `Share the temporary password with ${fullName.trim()}. It's shown on the Users page until they change it.`,
      });
      router.push('/travinco_dashboard/users');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Actions on top */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push('/travinco_dashboard/users')}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          data-confirm-save="true"
          data-confirm-label={isEdit ? 'Update' : 'Create user'}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {isPending ? (isEdit ? 'Updating...' : 'Creating...') : isEdit ? 'Update' : 'Create user'}
        </button>
      </div>

      <div className="card grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <label htmlFor="user-name" className="mb-1 block text-sm font-medium text-ink-700">
            Full name <span className="text-red-500">*</span>
          </label>
          <input
            id="user-name"
            maxLength={120}
            value={fullName}
            onChange={(e) => {
              const v = e.target.value.replace(/\d/g, '');
              setFullName(v);
              if (v !== e.target.value) setErrors((x) => ({ ...x, full_name: 'Numbers are not allowed in the name' }));
              else if (errors.full_name) setErrors((x) => ({ ...x, full_name: validateFullName(v) }));
            }}
            onBlur={() => setErrors((x) => ({ ...x, full_name: validateFullName(fullName) }))}
            placeholder="e.g. Rahul Sharma"
            className={cn('input', errors.full_name && 'border-red-400 focus:border-red-500')}
          />
          {errors.full_name && <p className="field-error">{errors.full_name}</p>}
        </div>

        <div>
          <label htmlFor="user-email" className="mb-1 block text-sm font-medium text-ink-700">
            Email address <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="user-email"
              type="email"
              value={email}
              disabled={isEdit}
              onChange={(e) => {
                setEmail(e.target.value.trim());
                if (errors.email) setErrors((x) => ({ ...x, email: validateEmailAddress(e.target.value) }));
              }}
              onBlur={() => !isEdit && setErrors((x) => ({ ...x, email: validateEmailAddress(email) }))}
              placeholder="e.g. rahul@travinco.in"
              className={cn(
                'input disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-600',
                isEdit && 'pr-9',
                errors.email && 'border-red-400 focus:border-red-500'
              )}
            />
            {isEdit && <Lock className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />}
          </div>
          {errors.email ? (
            <p className="field-error">{errors.email}</p>
          ) : (
            isEdit && <p className="mt-1 text-xs text-ink-400">The email is the sign-in ID and can&apos;t be changed.</p>
          )}
        </div>

        <div>
          <label htmlFor="user-role" className="mb-1 block text-sm font-medium text-ink-700">
            User role <span className="text-red-500">*</span>
          </label>
          <select
            id="user-role"
            value={roleId}
            disabled={isSelf}
            onChange={(e) => {
              setRoleId(e.target.value);
              setErrors((x) => ({ ...x, role: null }));
            }}
            className={cn('input disabled:cursor-not-allowed disabled:bg-ink-50', errors.role && 'border-red-400')}
          >
            <option value="">— Choose a role —</option>
            {props.roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.isSystem ? ' (full access)' : ` (${r.pages.length} pages)`}
              </option>
            ))}
          </select>
          {errors.role ? (
            <p className="field-error">{errors.role}</p>
          ) : isSelf ? (
            <p className="mt-1 text-xs text-ink-400">You can&apos;t change your own role.</p>
          ) : props.roles.length === 0 ? (
            <p className="mt-1 text-xs text-amber-700">No roles yet — create one on the Roles page first.</p>
          ) : null}
        </div>

        {!isEdit && (
          <div>
            <label htmlFor="user-password" className="mb-1 block text-sm font-medium text-ink-700">
              Temporary password <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="user-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  maxLength={72}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value.replace(/\s/g, ''));
                    if (errors.password) setErrors((x) => ({ ...x, password: null }));
                  }}
                  className={cn('input pr-9 font-mono', errors.password && 'border-red-400 focus:border-red-500')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button
                type="button"
                data-no-confirm-save="true"
                onClick={() => {
                  setPassword(generateTempPassword());
                  setErrors((x) => ({ ...x, password: null }));
                }}
                className="btn-outline whitespace-nowrap px-3 text-xs"
                title="Generate a strong temporary password"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Generate
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
            <p className="mt-1.5 text-[11px] text-ink-400">
              Shown on the Users page until the user changes it.
            </p>
          </div>
        )}
      </div>

      <div className="card space-y-3 p-5">
        <div>
          <h2 className="text-sm font-semibold text-ink-800">Pages this user can access</h2>
          <p className="text-xs text-ink-500">
            Comes from the selected role. To change it, edit the role on the Roles page.
          </p>
        </div>
        <RolePagesPreview role={selectedRole} />
      </div>
    </form>
  );
}
