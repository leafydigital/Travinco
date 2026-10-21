'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  updateEnquiryStatus,
  updateEnquiryPriority,
  assignEnquiry,
  updateEnquiryFollowupDate,
} from '../actions';
import type { EnquiryStatus, EnquiryPriority } from '@/types/database';

const statusDisplayList: { value: EnquiryStatus; label: string }[] = [
  { value: 'new', label: 'Pending' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'quotation_sent', label: 'Quotations Sent' },
  { value: 'booked', label: 'Booked' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'lost', label: 'Not Interested' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'closed', label: 'Closed' },
];

const priorityDisplayList: { value: EnquiryPriority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function EnquiryControls({
  enquiryId,
  currentStatus,
  currentPriority,
  currentAssignee,
  currentFollowupDate,
  staff,
  canEdit = true,
}: {
  enquiryId: string;
  currentStatus: EnquiryStatus;
  currentPriority: EnquiryPriority;
  currentAssignee: string | null;
  currentFollowupDate?: string | null;
  staff: { id: string; full_name: string }[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [followupDate, setFollowupDate] = useState(currentFollowupDate ?? '');

  function handle(promise: Promise<{ error?: string }>, successMsg?: string) {
    if (!canEdit) return;
    startTransition(async () => {
      const result = await promise;
      if (result.error) toast.error(result.error);
      else {
        if (successMsg) toast.success(successMsg);
        router.refresh();
      }
    });
  }

  function handleFollowupDateChange(newDate: string) {
    if (!canEdit) return;
    setFollowupDate(newDate);
    handle(
      updateEnquiryFollowupDate(enquiryId, newDate || null),
      newDate ? `Follow-up set to ${newDate}` : 'Follow-up date cleared'
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label className="label">Status</label>
        <select
          defaultValue={currentStatus}
          disabled={isPending || !canEdit}
          onChange={(e) =>
            handle(
              updateEnquiryStatus(enquiryId, e.target.value as EnquiryStatus),
              'Status updated'
            )
          }
          className="input"
        >
          {statusDisplayList.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Priority</label>
        <select
          defaultValue={currentPriority}
          disabled={isPending || !canEdit}
          onChange={(e) =>
            handle(
              updateEnquiryPriority(enquiryId, e.target.value as EnquiryPriority),
              'Priority updated'
            )
          }
          className="input"
        >
          {priorityDisplayList.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Next Follow-up Date</label>
        <input
          type="date"
          value={followupDate}
          disabled={isPending || !canEdit}
          onChange={(e) => handleFollowupDateChange(e.target.value)}
          className="input"
        />
      </div>
      <div>
        <label className="label">Assigned to</label>
        <select
          defaultValue={currentAssignee ?? ''}
          disabled={isPending || !canEdit}
          onChange={(e) =>
            handle(assignEnquiry(enquiryId, e.target.value || null), 'Assignee updated')
          }
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

