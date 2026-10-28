'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2, Loader2 } from 'lucide-react';
import { DeleteConfirmModal } from '@/app/travinco_dashboard/leads/delete-confirm-modal';

interface Props {
  /** Label used in the popup and toasts, e.g. "leads" or "enquiries". */
  entityLabel: string;
  /** Google Sheet tab the data is archived to. */
  sheetTab: string;
  action?: () => Promise<{ error?: string; count?: number }>;
  /** False when the page already knows the table is empty: button is disabled, no server call. */
  hasData?: boolean;
  /** Placeholder state while the page is still loading its counts. */
  loading?: boolean;
}

export function ClearDataButton({ entityLabel, sheetTab, action, hasData = true, loading = false }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isDisabled = loading || !hasData || !action || isPending;

  function handleConfirm() {
    if (!action) return;
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      if (!result.count) {
        toast.info(`There are no ${entityLabel} to clear.`);
        return; // nothing changed, no need to re-render the page
      }
      toast.success(`${result.count} ${entityLabel} archived to Google Sheets (${sheetTab} tab) and cleared.`);
      // Refresh outside the transition so the spinner stops as soon as the action finishes
      setTimeout(() => router.refresh(), 0);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isDisabled}
        title={!loading && !hasData ? `No ${entityLabel} to clear` : undefined}
        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-medium text-red-600 shadow-xs transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        {!loading && !hasData ? 'No Data to Clear' : 'Clear Data'}
      </button>

      <DeleteConfirmModal
        isOpen={open}
        title={`Clear all ${entityLabel}?`}
        description={`All ${entityLabel} will be saved to the "${sheetTab}" tab of the Google Sheet and then removed from this table. This affects every record, not only the filtered ones.`}
        confirmLabel={isPending ? 'Archiving…' : 'Yes, Clear Data'}
        isPending={isPending}
        onConfirm={handleConfirm}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
