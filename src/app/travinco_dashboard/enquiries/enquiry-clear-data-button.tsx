'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import { toast } from '@/lib/admin-alert';
import { ModalPortal } from '@/components/ui/modal-portal';
import { AdminDateField } from '@/components/admin/package-fields';
import { formatIsoAsDMY } from '@/components/public/date-picker-dmy';
import { todayIso } from '@/lib/utils/iso-date';
import { clearAndArchiveEnquiries, countEnquiriesInRange } from './actions';

/**
 * Admin "Clear Data": pick an Enquiry Date range (starts from the page's date
 * filter); the "Deal lost or not interested" enquiries in it are saved to the
 * Google Sheet "Enquiries" tab and then deleted from the database.
 */
export function EnquiryClearDataButton({ initialFrom = '', initialTo = '' }: { initialFrom?: string; initialTo?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [count, setCount] = useState<number | null>(null);
  const [countError, setCountError] = useState<string | null>(null);
  const [counting, setCounting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const today = todayIso();

  const rangeError = from && to && from > to ? 'The From date must be on or before the To date.' : null;

  // Live count for the chosen range
  useEffect(() => {
    setCount(null);
    setCountError(null);
    if (!open || !from || !to || from > to) return;
    let cancelled = false;
    setCounting(true);
    const t = setTimeout(async () => {
      const res: { error?: string; count?: number } = await countEnquiriesInRange({ from, to }).catch(() => ({
        error: 'Could not count the enquiries.',
      }));
      if (cancelled) return;
      setCounting(false);
      if (res.error) setCountError(res.error);
      else setCount(res.count ?? 0);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
      setCounting(false);
    };
  }, [open, from, to]);

  function close() {
    if (isPending) return;
    setOpen(false);
  }

  function handleConfirm() {
    startTransition(async () => {
      const res = await clearAndArchiveEnquiries({ from, to });
      if (res.error) {
        toast.error(res.error);
        if (res.count) setTimeout(() => router.refresh(), 0);
        return;
      }
      setOpen(false);
      setFrom('');
      setTo('');
      if (!res.count) {
        toast.info('There were no lost enquiries in that date range.');
        return;
      }
      toast.success(`${res.count} lost enquir${res.count === 1 ? 'y' : 'ies'} saved to the Google Sheet (Enquiries tab) and deleted.`);
      setTimeout(() => router.refresh(), 0);
    });
  }

  const canConfirm = Boolean(from && to && !rangeError && count && count > 0 && !counting);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          // Start from the dates chosen in the page filter
          setFrom(initialFrom);
          setTo(initialTo);
          setOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-medium text-red-600 shadow-xs transition-colors hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" /> Clear Data
      </button>

      {open && (
        <ModalPortal>
          {/* Top-aligned and scrollable, so the calendar under the date fields always has room */}
          <div className="fixed inset-0 z-50 overflow-y-auto bg-ink-950/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && close()}>
            <div className="card mx-auto mt-[8vh] mb-[50vh] w-full max-w-md shadow-xl">
              <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
                <h2 className="text-base font-semibold text-ink-900">Clear lost enquiries</h2>
                <button onClick={close} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 px-5 py-4">
                <p className="text-sm font-medium text-ink-700">Leads with Not Interested Moves to Google Sheet</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">From date</label>
                    <AdminDateField value={from} onChange={setFrom} min="2000-01-01" max={to || today} invalid={Boolean(rangeError)} />
                  </div>
                  <div>
                    <label className="label">To date</label>
                    <AdminDateField value={to} onChange={setTo} min={from || '2000-01-01'} max={today} invalid={Boolean(rangeError)} />
                  </div>
                </div>

                {rangeError && <p className="text-xs text-red-600">{rangeError}</p>}

                {from && to && !rangeError && (
                  <div
                    className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                      count ? 'border-red-200 bg-red-50 text-red-800' : 'border-ink-200 bg-ink-50 text-ink-600'
                    }`}
                  >
                    {counting ? (
                      <>
                        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> Counting enquiries…
                      </>
                    ) : countError ? (
                      <span className="text-red-700">{countError}</span>
                    ) : count ? (
                      <>
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                        <span>
                          <b>{count}</b> lost enquir{count === 1 ? 'y' : 'ies'} from {formatIsoAsDMY(from)} to {formatIsoAsDMY(to)} will
                          be deleted. This cannot be undone from the dashboard.
                        </span>
                      </>
                    ) : (
                      <span>No &ldquo;Deal lost or not interested&rdquo; enquiries in this date range.</span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-ink-100 px-5 py-4">
                <button type="button" onClick={close} disabled={isPending} className="btn-outline">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!canConfirm || isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {isPending ? 'Saving & deleting…' : count ? `Delete ${count}` : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
