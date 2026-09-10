'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { updateEnquiryStatus, updateEnquiryPriority, assignEnquiry } from '../actions';
import type { EnquiryStatus, EnquiryPriority } from '@/types/database';

const statuses: EnquiryStatus[] = [
  'new', 'contacted', 'follow_up', 'quotation_sent', 'negotiation',
  'confirmed', 'lost', 'closed',
];
const priorities: EnquiryPriority[] = ['low', 'medium', 'high', 'urgent'];

export function EnquiryControls({
  enquiryId,
  currentStatus,
  currentPriority,
  currentAssignee,
  staff,
}: {
  enquiryId: string;
  currentStatus: EnquiryStatus;
  currentPriority: EnquiryPriority;
  currentAssignee: string | null;
  staff: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handle(promise: Promise<{ error?: string }>) {
    startTransition(async () => {
      const result = await promise;
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div>
        <label className="label">Status</label>
        <select
          defaultValue={currentStatus}
          disabled={isPending}
          onChange={(e) => handle(updateEnquiryStatus(enquiryId, e.target.value as EnquiryStatus))}
          className="input"
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Priority</label>
        <select
          defaultValue={currentPriority}
          disabled={isPending}
          onChange={(e) =>
            handle(updateEnquiryPriority(enquiryId, e.target.value as EnquiryPriority))
          }
          className="input"
        >
          {priorities.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Assigned to</label>
        <select
          defaultValue={currentAssignee ?? ''}
          disabled={isPending}
          onChange={(e) => handle(assignEnquiry(enquiryId, e.target.value || null))}
          className="input"
        >
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
