'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { X, Plus } from 'lucide-react';
import type { Tables } from '@/types/database';

type Item = Tables<'package_inclusions'> | Tables<'package_exclusions'>;

export function InclusionExclusionManager({
  packageId,
  items,
  onAdd,
  onRemove,
  label,
}: {
  packageId: string;
  items: Item[];
  onAdd: (packageId: string, raw: { item: string }) => Promise<{ error?: string }>;
  onRemove: (packageId: string, id: string) => Promise<{ error?: string }>;
  label: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState('');
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

  function remove(id: string) {
    startTransition(async () => {
      const result = await onRemove(packageId, id);
      if (result.error) toast.error(result.error);
      router.refresh();
    });
  }

  return (
    <div>
      <p className="label">{label}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <span className="flex-1 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-700">
              {item.item}
            </span>
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
        ))}
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
      </div>
    </div>
  );
}
