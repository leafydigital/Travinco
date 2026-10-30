'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { toast, confirmAlert } from '@/lib/admin-alert';

/**
 * Shown while records deleted before deletes became permanent are still in the
 * database (they are already hidden from the table). One click saves them to
 * Google Sheets and removes them for good.
 */
export function PurgeDeletedBanner({
  count,
  entity,
  sheetTab,
  action,
}: {
  count: number;
  /** Singular noun, e.g. "user" or "customer". */
  entity: string;
  sheetTab: string;
  action: () => Promise<{ error?: string; count?: number }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const label = `${count} ${entity}${count === 1 ? '' : 's'}`;

  async function handleClick() {
    const ok = await confirmAlert({
      title: `Remove ${label} permanently?`,
      text: `They are saved to the Google Sheet "${sheetTab}" tab first, then removed from the database.`,
      confirmText: 'Remove permanently',
      icon: 'warning',
      danger: true,
    });
    if (!ok) return;
    start(async () => {
      const res = await action();
      if (res.error) toast.error(res.error);
      else toast.success(`${res.count ?? 0} ${entity}${res.count === 1 ? '' : 's'} removed permanently`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p>
        <span className="font-semibold">{label}</span> deleted earlier {count === 1 ? 'is' : 'are'} still stored in the
        database (hidden from this list).
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        data-no-confirm-save="true"
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        Remove permanently
      </button>
    </div>
  );
}
