'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/admin-alert';
import { ChevronDown, Check, Loader2 } from 'lucide-react';
import { updateEnquiryStatus } from './actions';
import type { EnquiryStatus } from '@/types/database';
import { StatusBadge } from '@/components/ui/status-badge';

export const ENQUIRY_STATUS_OPTIONS: {
  value: EnquiryStatus;
  label: string;
  badgeClass: string;
  dotColor: string;
}[] = [
  {
    value: 'new',
    label: 'Pending',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80 hover:bg-amber-100/70',
    dotColor: 'bg-amber-500',
  },
  {
    value: 'contacted',
    label: 'Contacted',
    badgeClass: 'bg-sand-100 text-sand-800 border-sand-200 hover:bg-sand-200/70',
    dotColor: 'bg-sand-500',
  },
  {
    value: 'follow_up',
    label: 'Follow Up',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200/80 hover:bg-purple-100/70',
    dotColor: 'bg-purple-500',
  },
  {
    value: 'quotation_sent',
    label: 'Quotations Sent',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200/80 hover:bg-indigo-100/70',
    dotColor: 'bg-indigo-500',
  },
  {
    value: 'negotiation',
    label: 'Negotiation',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200/80 hover:bg-blue-100/70',
    dotColor: 'bg-blue-500',
  },
  {
    value: 'booked',
    label: 'Booked',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100/70',
    dotColor: 'bg-emerald-500',
  },
  {
    value: 'confirmed',
    label: 'Confirmed',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100/70',
    dotColor: 'bg-emerald-500',
  },
  {
    value: 'lost',
    label: 'Not Interested',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200/80 hover:bg-rose-100/70',
    dotColor: 'bg-rose-500',
  },
  {
    value: 'closed',
    label: 'Closed',
    badgeClass: 'bg-ink-100 text-ink-600 border-ink-200 hover:bg-ink-200/70',
    dotColor: 'bg-ink-400',
  },
];

interface EnquiryStatusSelectorProps {
  enquiryId: string;
  currentStatus: EnquiryStatus | string;
  canEdit?: boolean;
}

export function EnquiryStatusSelector({
  enquiryId,
  currentStatus,
  canEdit = true,
}: EnquiryStatusSelectorProps) {
  const router = useRouter();
  const [current, setCurrent] = useState<EnquiryStatus>(currentStatus as EnquiryStatus);
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync state if prop changes from parent / router refresh
  useEffect(() => {
    setCurrent(currentStatus as EnquiryStatus);
  }, [currentStatus]);

  // Sync state if changed from EnquiryControls or other components
  useEffect(() => {
    function onStatusChange(e: Event) {
      const customEvent = e as CustomEvent<{ enquiryId: string; status: EnquiryStatus }>;
      if (customEvent.detail?.enquiryId === enquiryId && customEvent.detail.status !== current) {
        setCurrent(customEvent.detail.status);
      }
    }
    window.addEventListener('travinco:enquiry-status-changed', onStatusChange);
    return () => {
      window.removeEventListener('travinco:enquiry-status-changed', onStatusChange);
    };
  }, [enquiryId, current]);

  const activeConfig =
    ENQUIRY_STATUS_OPTIONS.find((o) => o.value === current) ?? {
      value: 'new' as EnquiryStatus,
      label: 'Pending',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80 hover:bg-amber-100/70',
      dotColor: 'bg-amber-500',
    };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  function toggleDropdown() {
    if (!canEdit) return;
    if (!isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < 260 && rect.top > 260);
    }
    setIsOpen((prev) => !prev);
  }

  function handleSelect(newStatus: EnquiryStatus) {
    setIsOpen(false);
    if (newStatus === current) return;

    const previousStatus = current;
    setCurrent(newStatus);
    window.dispatchEvent(
      new CustomEvent('travinco:enquiry-status-changed', {
        detail: { enquiryId, status: newStatus },
      })
    );

    startTransition(async () => {
      const res = await updateEnquiryStatus(enquiryId, newStatus);
      if (res?.error) {
        toast.error(res.error);
        setCurrent(previousStatus);
        window.dispatchEvent(
          new CustomEvent('travinco:enquiry-status-changed', {
            detail: { enquiryId, status: previousStatus },
          })
        );
        return;
      }
      const label = ENQUIRY_STATUS_OPTIONS.find((o) => o.value === newStatus)?.label || newStatus;
      toast.success(`Enquiry status updated to ${label}`);
      router.refresh();
    });
  }

  // If user cannot edit, render standard read-only status badge
  if (!canEdit) {
    return <StatusBadge status={current} />;
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={toggleDropdown}
        disabled={isPending}
        title="Click to change enquiry status"
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border transition-all cursor-pointer shadow-2xs hover:shadow-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 ${activeConfig.badgeClass}`}
      >
        <span className={`h-2 w-2 rounded-full shrink-0 ${activeConfig.dotColor}`} />
        <span>{activeConfig.label}</span>
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin ml-0.5 opacity-70" />
        ) : (
          <ChevronDown
            className={`h-3.5 w-3.5 ml-0.5 opacity-60 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>

      {isOpen && (
        <div
          className={`absolute z-50 w-52 rounded-2xl border border-ink-200/90 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150 ${
            openUpward ? 'bottom-full mb-1.5 left-0' : 'top-full mt-1.5 left-0'
          }`}
        >
          <div className="px-2.5 py-1.5 border-b border-ink-100 mb-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
              Update Status
            </p>
          </div>

          <div className="space-y-0.5">
            {ENQUIRY_STATUS_OPTIONS.map((option) => {
              const isSelected = option.value === current;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-brand-50 text-brand-900 font-semibold'
                      : 'text-ink-700 hover:bg-ink-50 hover:text-ink-950'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${option.dotColor}`} />
                    <span>{option.label}</span>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-brand-600" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
