'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { X, Plus, Pencil, Check } from 'lucide-react';
import type { Tables } from '@/types/database';

type Item = Tables<'package_inclusions'> | Tables<'package_exclusions'>;

export function InclusionExclusionManager({
  packageId,
  items,
  onAdd,
  onAddBulk,
  onUpdate,
  onRemove,
  label,
}: {
  packageId: string;
  items: Item[];
  onAdd: (packageId: string, raw: { item: string }) => Promise<{ error?: string }>;
  onAddBulk: (packageId: string, items: string[]) => Promise<{ error?: string }>;
  onUpdate: (packageId: string, id: string, raw: { item: string }) => Promise<{ error?: string }>;
  onRemove: (packageId: string, id: string) => Promise<{ error?: string }>;
  label: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isPending, startTransition] = useTransition();

  function add() {
    if (!draft.trim()) return;
    startTransition(async () => {
      const result = await onAdd(packageId, { item: draft.trim() });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setDraft('');
      router.refresh();
    });
  }

  function addBulk() {
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    startTransition(async () => {
      const result = await onAddBulk(packageId, lines);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${lines.length} item${lines.length === 1 ? '' : 's'} added`);
      setBulkText('');
      setBulkMode(false);
      router.refresh();
    });
  }

  function startEdit(item: Item) {
    setEditingId(item.id);
    setEditValue(item.item);
  }

  function saveEdit(id: string) {
    if (!editValue.trim()) return;
    startTransition(async () => {
      const result = await onUpdate(packageId, id, { item: editValue.trim() });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await onRemove(packageId, id);
      if (result.error) toast.error(result.error);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="label">{label}</p>
        <button
          type="button"
          onClick={() => setBulkMode((m) => !m)}
          className="text-xs text-brand-600 hover:underline"
        >
          {bulkMode ? 'Add one at a time' : 'Add multiple at once'}
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item) =>
          editingId === item.id ? (
            <div key={item.id} className="flex items-center gap-2">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveEdit(item.id);
                  }
                }}
                autoFocus
                className="input flex-1"
              />
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-lg p-2 text-ink-400 hover:bg-ink-100"
                aria-label="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => saveEdit(item.id)}
                disabled={isPending}
                className="rounded-lg p-2 text-brand-600 hover:bg-brand-50"
                aria-label="Save"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div key={item.id} className="flex items-center gap-2">
              <span className="flex-1 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-700">
                {item.item}
              </span>
              <button
                type="button"
                onClick={() => startEdit(item)}
                className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                aria-label={`Edit ${item.item}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => remove(item.id)}
                disabled={isPending}
                className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"
                aria-label={`Remove ${item.item}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        )}

        {bulkMode ? (
          <div className="space-y-2">
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={4}
              placeholder={'One item per line, e.g.\nAirport transfers\nDaily breakfast\nAll entry fees'}
              className="input w-full"
            />
            <button type="button" onClick={addBulk} disabled={isPending} className="btn-outline w-full">
              <Plus className="h-4 w-4" /> Add all lines
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
              className="input flex-1"
              placeholder="Type an item and press Enter"
            />
            <button type="button" onClick={add} disabled={isPending} className="btn-outline shrink-0">
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
