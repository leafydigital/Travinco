'use client';

import { useState } from 'react';
import { Star, X, Loader2 } from 'lucide-react';
import { toast } from '@/lib/admin-alert';
import { unfeatureDestination } from './actions';
import { ModalPortal } from '@/components/ui/modal-portal';

export const MAX_FEATURED_DESTINATIONS = 3;

export type FeaturedDestination = { id: string; name: string };

/**
 * Shown when someone tries to feature a 4th destination. Lists the currently
 * featured destinations (saved ones can be un-featured right here) so the user
 * can free a slot.
 */
export function FeaturedLimitDialog({
  open,
  featured,
  pending = [],
  onUnfeatured,
  onUnfeaturePending,
  onClose,
}: {
  open: boolean;
  /** Saved destinations that are currently featured. */
  featured: FeaturedDestination[];
  /** Unsaved destinations in the current form(s) that are marked featured. */
  pending?: FeaturedDestination[];
  onUnfeatured: (id: string) => void;
  onUnfeaturePending?: (id: string) => void;
  onClose: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  if (!open) return null;

  async function handleUnfeature(id: string) {
    setBusyId(id);
    const res = await unfeatureDestination(id);
    setBusyId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Destination un-featured');
    onUnfeatured(id);
  }

  const rows = [
    ...featured.map((d) => ({ ...d, saved: true })),
    ...pending.map((d) => ({ ...d, saved: false })),
  ];

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-ink-950/50 z-[60] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md rounded-2xl border border-ink-100 bg-white p-5 shadow-lg shadow-ink-900/5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Star className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold text-ink-900">Featured limit reached</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-ink-600">
            Only {MAX_FEATURED_DESTINATIONS} destinations can be featured at a time. Un-feature one of
            the destinations below to feature this one.
          </p>
          <ul className="mt-4 divide-y divide-ink-100 rounded-xl border border-ink-100">
            {rows.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="truncate text-sm font-medium text-ink-800">
                  {d.name || 'Untitled destination'}
                  {!d.saved && <span className="ml-1.5 text-xs font-normal text-ink-400">(this form)</span>}
                </span>
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => (d.saved ? handleUnfeature(d.id) : onUnfeaturePending?.(d.id))}
                  className="btn-outline inline-flex h-8 shrink-0 items-center gap-1.5 px-3 text-xs"
                >
                  {busyId === d.id && <Loader2 className="h-3 w-3 animate-spin" />}
                  Un-feature
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={onClose} className="btn-outline h-9 px-4 text-xs">
              Close
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
