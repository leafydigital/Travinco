'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Search, Pencil, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Generic table + dialog form for simple master-data tables
 * (transport, pickup points, activities, distances, locations, day plans).
 * Everything here is declarative so it can be configured from a Server
 * Component; saving goes through the Server Actions passed in.
 */

export type Option = { value: string; label: string };

export type FieldDef = {
  name: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'select' | 'checkbox' | 'tel' | 'email' | 'url' | 'time';
  options?: Option[];
  required?: boolean;
  hint?: string;
  placeholder?: string;
  /** grid columns the field spans (out of 2) */
  span?: 1 | 2;
  step?: string;
  rows?: number;
  /** show only when another field has one of these values */
  showIf?: { field: string; values: string[] };
};

export type ColumnDef = {
  key: string;
  label: string;
  format?: 'money' | 'bool' | 'lookup' | 'km' | 'text' | 'badge';
  lookup?: Record<string, string>;
  /** a second key rendered small under the main value */
  sub?: string;
  align?: 'left' | 'right' | 'center';
  className?: string;
};

export type FilterDef = { key: string; label: string; options: Option[] };

type Row = Record<string, unknown> & { id: number | string };

type ActionResult = { error?: string } | undefined | void;

export function EntityManager({
  rows,
  fields,
  columns,
  canEdit,
  saveAction,
  deleteAction,
  searchKeys,
  filters = [],
  newLabel = 'Add new',
  entityName = 'record',
  emptyText = 'Nothing here yet.',
  defaults = {},
  pageSize = 50,
}: {
  rows: Row[];
  fields: FieldDef[];
  columns: ColumnDef[];
  canEdit: boolean;
  saveAction: (id: number | string | null, data: Record<string, unknown>) => Promise<ActionResult>;
  deleteAction?: (id: number | string) => Promise<ActionResult>;
  searchKeys: string[];
  filters?: FilterDef[];
  newLabel?: string;
  entityName?: string;
  emptyText?: string;
  defaults?: Record<string, unknown>;
  pageSize?: number;
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [filterVals, setFilterVals] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ id: number | string | null; data: Record<string, unknown> } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Row | null>(null);
  const [page, setPage] = useState(1);
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => {
      for (const f of filters) {
        const v = filterVals[f.key];
        if (v && String(r[f.key] ?? '') !== v) return false;
      }
      if (!t) return true;
      return searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(t));
    });
  }, [rows, q, filterVals, filters, searchKeys]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  const openNew = () => {
    const data: Record<string, unknown> = { ...defaults };
    for (const f of filters) if (filterVals[f.key] && data[f.key] == null) data[f.key] = filterVals[f.key];
    setEditing({ id: null, data });
  };

  const fmt = (c: ColumnDef, v: unknown) => {
    if (v == null || v === '') return <span className="text-ink-300">—</span>;
    switch (c.format) {
      case 'money':
        return `₹${Math.round(Number(v)).toLocaleString('en-IN')}`;
      case 'km':
        return `${Number(v).toLocaleString('en-IN')} km`;
      case 'bool':
        return v ? (
          <span className="badge bg-brand-100 text-brand-800">Yes</span>
        ) : (
          <span className="badge bg-ink-100 text-ink-500">No</span>
        );
      case 'lookup':
        return c.lookup?.[String(v)] ?? String(v);
      case 'badge':
        return <span className="badge bg-ocean-50 text-ocean-800">{c.lookup?.[String(v)] ?? String(v)}</span>;
      default:
        return String(v);
    }
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.type === 'checkbox') data[f.name] = fd.get(f.name) === 'on';
      else {
        const v = fd.get(f.name);
        data[f.name] = v == null ? null : String(v);
      }
    }
    start(async () => {
      const res = await saveAction(editing.id, data);
      if (res && 'error' in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(editing.id == null ? `${capital(entityName)} added` : `${capital(entityName)} saved`);
      setEditing(null);
      router.refresh();
    });
  };

  const doDelete = () => {
    if (!confirmDelete || !deleteAction) return;
    const id = confirmDelete.id;
    start(async () => {
      const res = await deleteAction(id);
      if (res && 'error' in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${capital(entityName)} deleted`);
      setConfirmDelete(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search…"
            className="input pl-9"
          />
        </div>
        {filters.map((f) => (
          <select
            key={f.key}
            aria-label={f.label}
            className="input w-auto min-w-[160px]"
            value={filterVals[f.key] ?? ''}
            onChange={(e) => {
              setFilterVals((s) => ({ ...s, [f.key]: e.target.value }));
              setPage(1);
            }}
          >
            <option value="">All {f.label.toLowerCase()}</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ))}
        <span className="text-sm text-ink-400">{filtered.length} shown</span>
        {canEdit && (
          <button type="button" className="btn-primary ml-auto" onClick={openNew}>
            <Plus className="h-4 w-4" /> {newLabel}
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                {columns.map((c) => (
                  <th key={c.key} className={cn('px-4 py-3 whitespace-nowrap', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center')}>
                    {c.label}
                  </th>
                ))}
                {canEdit && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-10 text-center text-ink-400">
                    {emptyText}
                  </td>
                </tr>
              )}
              {visible.map((r) => (
                <tr key={String(r.id)} className="border-b border-ink-50 align-top last:border-0 hover:bg-ink-50/50">
                  {columns.map((c, i) => (
                    <td
                      key={c.key}
                      className={cn(
                        'px-4 py-3',
                        i === 0 && 'font-medium text-ink-800',
                        c.align === 'right' && 'text-right tabular-nums',
                        c.align === 'center' && 'text-center',
                        c.className
                      )}
                    >
                      <div>{fmt(c, r[c.key])}</div>
                      {c.sub && r[c.sub] != null && r[c.sub] !== '' && <div className="text-xs font-normal text-ink-400">{String(r[c.sub])}</div>}
                    </td>
                  ))}
                  {canEdit && (
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-ink-500 hover:bg-brand-50 hover:text-brand-700"
                        title="Edit"
                        onClick={() => setEditing({ id: r.id, data: r })}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {deleteAction && (
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-ink-500 hover:bg-red-50 hover:text-red-600"
                          title="Delete"
                          onClick={() => setConfirmDelete(r)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3 text-sm text-ink-500">
            <span>
              Page {page} of {pages}
            </span>
            <div className="flex gap-2">
              <button className="btn-outline px-3 py-1.5" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <button className="btn-outline px-3 py-1.5" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <Dialog title={editing.id == null ? newLabel : `Edit ${entityName}`} onClose={() => setEditing(null)}>
          <EntityForm fields={fields} initial={editing.data} pending={pending} onSubmit={submit} onCancel={() => setEditing(null)} />
        </Dialog>
      )}

      {confirmDelete && (
        <Dialog title={`Delete ${entityName}?`} onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-ink-600">
            This permanently deletes <b>{String(confirmDelete[columns[0]?.key ?? 'id'] ?? '')}</b>. This cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
            <button className="btn-danger" disabled={pending} onClick={doDelete}>
              {pending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function EntityForm({
  fields,
  initial,
  pending,
  onSubmit,
  onCancel,
}: {
  fields: FieldDef[];
  initial: Record<string, unknown>;
  pending: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const [vals, setVals] = useState<Record<string, unknown>>(initial);
  const shown = (f: FieldDef) => !f.showIf || f.showIf.values.includes(String(vals[f.showIf.field] ?? ''));
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f) => {
          if (!shown(f)) return <input key={f.name} type="hidden" name={f.name} value={vals[f.name] == null ? '' : String(vals[f.name])} />;
          const v = vals[f.name];
          const set = (nv: unknown) => setVals((s) => ({ ...s, [f.name]: nv }));
          const span = f.span === 2 || f.type === 'textarea' ? 'sm:col-span-2' : '';
          if (f.type === 'checkbox')
            return (
              <label key={f.name} className={cn('flex items-center gap-2 pt-1 text-sm text-ink-700', span)}>
                <input type="checkbox" name={f.name} checked={!!v} onChange={(e) => set(e.target.checked)} className="rounded border-ink-300 text-brand-700" />
                {f.label}
              </label>
            );
          return (
            <div key={f.name} className={span}>
              <label className="label" htmlFor={`f-${f.name}`}>
                {f.label}
                {f.required && <span className="text-red-500"> *</span>}
              </label>
              {f.type === 'select' ? (
                <select id={`f-${f.name}`} name={f.name} required={f.required} className="input" value={v == null ? '' : String(v)} onChange={(e) => set(e.target.value)}>
                  {!f.required && <option value="">—</option>}
                  {f.required && v == null && <option value="">Select…</option>}
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea
                  id={`f-${f.name}`}
                  name={f.name}
                  required={f.required}
                  rows={f.rows ?? 3}
                  placeholder={f.placeholder}
                  className="input font-[inherit]"
                  value={v == null ? '' : String(v)}
                  onChange={(e) => set(e.target.value)}
                />
              ) : (
                <input
                  id={`f-${f.name}`}
                  name={f.name}
                  type={f.type}
                  required={f.required}
                  step={f.step ?? (f.type === 'number' ? 'any' : undefined)}
                  min={f.type === 'number' ? 0 : undefined}
                  placeholder={f.placeholder}
                  className="input"
                  value={v == null ? '' : String(v)}
                  onChange={(e) => set(e.target.value)}
                />
              )}
              {f.hint && <p className="mt-1 text-xs text-ink-400">{f.hint}</p>}
            </div>
          );
        })}
      </div>
      <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
        <button type="button" className="btn-outline" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

export function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/40 p-4 sm:p-8 print:hidden" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn('card w-full bg-white p-5 shadow-xl', wide ? 'max-w-4xl' : 'max-w-2xl')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
