'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { acceptEnquiry, rejectEnquiry } from '../actions';
import { CheckCircle2, XCircle } from 'lucide-react';

export function AcceptRejectButtons({
  enquiryId,
  currentStatus,
}: {
  enquiryId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [reason, setReason] = useState('');

  const alreadyDecided = currentStatus === 'confirmed' || currentStatus === 'lost';

  function handleAccept() {
    if (!confirm('Accept this enquiry? The customer will be emailed.')) return;
    startTransition(async () => {
      const result = await acceptEnquiry(enquiryId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Enquiry accepted — customer notified');
      router.refresh();
    });
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectEnquiry(enquiryId, reason);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Enquiry rejected — customer notified');
      setShowRejectReason(false);
      setReason('');
      router.refresh();
    });
  }

  if (alreadyDecided) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
          currentStatus === 'confirmed' ? 'bg-brand-50 text-brand-700' : 'bg-coral-50 text-coral-700'
        }`}
      >
        {currentStatus === 'confirmed' ? (
          <>
            <CheckCircle2 className="h-4 w-4" /> Accepted
          </>
        ) : (
          <>
            <XCircle className="h-4 w-4" /> Rejected
          </>
        )}
      </span>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button onClick={handleAccept} disabled={isPending} className="btn-primary">
          <CheckCircle2 className="h-4 w-4" /> Accept
        </button>
        <button
          onClick={() => setShowRejectReason((s) => !s)}
          disabled={isPending}
          className="btn-outline border-coral-300 text-coral-600 hover:bg-coral-50"
        >
          <XCircle className="h-4 w-4" /> Reject
        </button>
      </div>

      {showRejectReason && (
        <div className="rounded-lg border border-ink-100 p-3">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional — included in the email to the customer)"
            rows={2}
            className="input w-full"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowRejectReason(false)}
              className="btn-outline"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={isPending}
              className="btn-primary bg-coral-600 hover:bg-coral-700"
            >
              {isPending ? 'Rejecting…' : 'Confirm reject'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
