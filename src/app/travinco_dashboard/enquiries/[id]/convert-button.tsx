'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { convertEnquiryToBooking } from '../actions';
import { formatCurrency } from '@/lib/utils/format';
import { ArrowRightCircle, X } from 'lucide-react';

export function ConvertToBookingButton({
  enquiryId,
  hasPackage,
  computedAmount,
}: {
  enquiryId: string;
  hasPackage: boolean;
  /** Auto-calculated from the linked package's price × traveler count —
   * shown as the starting point, editable before converting. */
  computedAmount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [baseAmount, setBaseAmount] = useState(computedAmount);
  const [discountAmount, setDiscountAmount] = useState(0);

  const total = Math.max(0, baseAmount - discountAmount);

  function handleConvert() {
    startTransition(async () => {
      const result = await convertEnquiryToBooking(enquiryId, { baseAmount, discountAmount });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Booking created');
      if (result.bookingId) router.push(`/admin/bookings/${result.bookingId}`);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={!hasPackage}
        title={!hasPackage ? 'Link a package to this enquiry first' : undefined}
        className="btn-primary"
      >
        <ArrowRightCircle className="h-4 w-4" />
        Convert to booking
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4">
          <div className="w-full max-w-sm rounded-xl2 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-800">Confirm booking amount</h2>
              <button onClick={() => setOpen(false)} className="text-ink-400 hover:text-ink-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="label">Total amount</label>
                <input
                  type="number"
                  min={0}
                  value={baseAmount}
                  onChange={(e) => setBaseAmount(Number(e.target.value) || 0)}
                  className="input"
                />
                <p className="mt-1 text-xs text-ink-400">
                  Auto-calculated from the package price — edit if this trip needs a custom
                  amount.
                </p>
              </div>

              <div>
                <label className="label">Discount (optional)</label>
                <input
                  type="number"
                  min={0}
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                  className="input"
                />
              </div>

              <div className="flex items-center justify-between border-t border-ink-100 pt-3 text-sm">
                <span className="text-ink-500">Final total</span>
                <span className="font-semibold text-ink-900">{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-outline">
                Cancel
              </button>
              <button type="button" onClick={handleConvert} disabled={isPending} className="btn-primary">
                {isPending ? 'Converting…' : 'Confirm & convert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
