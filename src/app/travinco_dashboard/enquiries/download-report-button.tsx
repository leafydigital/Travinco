'use client';

import { useState, useTransition } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import { toast } from '@/lib/admin-alert';
import { ModalPortal } from '@/components/ui/modal-portal';
import { AdminDateField } from '@/components/admin/package-fields';
import { todayIso } from '@/lib/utils/iso-date';
import { ENQUIRY_STATUS_OPTIONS } from '@/lib/enquiry-status';
import { getEnquiryReportRows } from './actions';

/**
 * "Download Report": pick an Enquiry Date range and (optionally) a status, and
 * download the matching enquiries as an Excel sheet. Starts from the page's filters.
 */
export function DownloadReportButton({
  initialFrom = '',
  initialTo = '',
  initialStatus = '',
}: {
  initialFrom?: string;
  initialTo?: string;
  initialStatus?: string;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [status, setStatus] = useState(initialStatus);
  const [isPending, startTransition] = useTransition();
  const today = todayIso();

  const rangeError = from && to && from > to ? 'The From date must be on or before the To date.' : null;
  const canDownload = Boolean(from && to && !rangeError);

  function close() {
    if (isPending) return;
    setOpen(false);
  }

  function handleDownload() {
    startTransition(async () => {
      const res = await getEnquiryReportRows({ from, to, status }).catch(() => ({
        error: 'Could not load the enquiries. Please try again.',
      }));
      if ('error' in res && res.error) {
        toast.error(res.error);
        return;
      }
      const { headers = [], rows = [] } = res as { headers?: string[]; rows?: (string | number | null)[][] };
      if (rows.length === 0) {
        toast.info('There are no enquiries for the chosen dates and status.');
        return;
      }

      const XLSX = await import('xlsx');
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map((h) => ({ wch: Math.max(12, h.length + 2) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Enquiries');
      const statusPart = status ? `_${status}` : '';
      XLSX.writeFile(wb, `enquiries_report_${from}_to_${to}${statusPart}.xlsx`);

      toast.success(`Downloaded ${rows.length} enquir${rows.length === 1 ? 'y' : 'ies'}.`);
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          // Start from the filters chosen on the page
          setFrom(initialFrom);
          setTo(initialTo);
          setStatus(initialStatus);
          setOpen(true);
        }}
        className="btn-outline flex items-center gap-2 text-sm"
      >
        <Download className="h-4 w-4" /> Download Report
      </button>

      {open && (
        <ModalPortal>
          {/* Top-aligned and scrollable, so the calendar under the date fields always has room */}
          <div className="fixed inset-0 z-50 overflow-y-auto bg-ink-950/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && close()}>
            <div className="card mx-auto mt-[8vh] mb-[50vh] w-full max-w-md shadow-xl">
              <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
                <h2 className="text-base font-semibold text-ink-900">Download enquiries report</h2>
                <button onClick={close} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 px-5 py-4">
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

                <div>
                  <label className="label">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-full">
                    <option value="">All statuses</option>
                    {ENQUIRY_STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-ink-100 px-5 py-4">
                <button type="button" onClick={close} disabled={isPending} className="btn-outline">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={!canDownload || isPending}
                  className="btn-primary flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {isPending ? 'Preparing…' : 'Download Excel'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
