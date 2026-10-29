'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  updateEnquiryStatus,
  updateEnquiryPriority,
  assignEnquiry,
  updateEnquiryFollowupDate,
} from '../actions';
import type { EnquiryStatus, EnquiryPriority } from '@/types/database';
import { AdminDateField } from '@/components/admin/package-fields';
import { formatIsoAsDMY } from '@/components/public/date-picker-dmy';
import { addYearsIso, todayIso } from '@/lib/utils/iso-date';

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
  const [status, setStatus] = useState<EnquiryStatus>(currentStatus);
  const [priority, setPriority] = useState<EnquiryPriority>(currentPriority);
  const [assignee, setAssignee] = useState<string | null>(currentAssignee);
  const [followupDate, setFollowupDate] = useState(currentFollowupDate ?? '');

  // Keep state in sync if server props change (e.g. after router.refresh())
  useEffect(() => {
    setStatus(currentStatus);
  }, [currentStatus]);

  useEffect(() => {
    setPriority(currentPriority);
  }, [currentPriority]);

  useEffect(() => {
    setAssignee(currentAssignee);
  }, [currentAssignee]);

  useEffect(() => {
    setFollowupDate(currentFollowupDate ?? '');
  }, [currentFollowupDate]);

  // Real-time synchronization with top EnquiryStatusSelector or other components
  useEffect(() => {
    function onStatusChange(e: Event) {
      const customEvent = e as CustomEvent<{ enquiryId: string; status: EnquiryStatus }>;
      if (customEvent.detail?.enquiryId === enquiryId) {
        setStatus(customEvent.detail.status);
      }
    }
    window.addEventListener('travinco:enquiry-status-changed', onStatusChange);
    return () => {
      window.removeEventListener('travinco:enquiry-status-changed', onStatusChange);
    };
  }, [enquiryId]);

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

  function handleStatusChange(newStatus: EnquiryStatus) {
    if (!canEdit) return;
    const previousStatus = status;
    setStatus(newStatus);
    window.dispatchEvent(
      new CustomEvent('travinco:enquiry-status-changed', {
        detail: { enquiryId, status: newStatus },
      })
    );
    startTransition(async () => {
      const result = await updateEnquiryStatus(enquiryId, newStatus);
      if (result.error) {
        toast.error(result.error);
        setStatus(previousStatus);
        window.dispatchEvent(
          new CustomEvent('travinco:enquiry-status-changed', {
            detail: { enquiryId, status: previousStatus },
          })
        );
      } else {
        toast.success('Status updated');
        router.refresh();
      }
    });
  }

  function handleFollowupDateChange(newDate: string) {
    if (!canEdit) return;
    if (newDate && newDate < todayStr) {
      toast.error('Next follow-up date cannot be in the past.');
      return;
    }
    if (newDate && newDate > maxFollowupDate) {
      toast.error('Next follow-up date must be within 1 year from today.');
      return;
    }
    setFollowupDate(newDate);
    handle(
      updateEnquiryFollowupDate(enquiryId, newDate || null),
      newDate ? `Follow-up set to ${formatIsoAsDMY(newDate)}` : 'Follow-up date cleared'
    );
  }

  const todayStr = todayIso();
  const maxFollowupDate = addYearsIso(todayStr, 1);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label className="label">Status</label>
        <select
          value={status}
          disabled={isPending || !canEdit}
          onChange={(e) => handleStatusChange(e.target.value as EnquiryStatus)}
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
          value={priority}
          disabled={isPending || !canEdit}
          onChange={(e) => {
            const newPri = e.target.value as EnquiryPriority;
            setPriority(newPri);
            handle(updateEnquiryPriority(enquiryId, newPri), 'Priority updated');
          }}
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
        {isPending || !canEdit ? (
          <div className="input flex items-center bg-ink-50 text-ink-500">
            {followupDate ? formatIsoAsDMY(followupDate) : 'DD/MM/YYYY'}
          </div>
        ) : (
          <AdminDateField
            value={followupDate}
            onChange={handleFollowupDateChange}
            min={todayStr}
            max={maxFollowupDate}
          />
        )}
      </div>
      <div>
        <label className="label">Assigned to</label>
        <select
          value={assignee ?? ''}
          disabled={isPending || !canEdit}
          onChange={(e) => {
            const val = e.target.value || null;
            setAssignee(val);
            handle(assignEnquiry(enquiryId, val), 'Assignee updated');
          }}
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

