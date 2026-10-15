'use client';

import { useTransition, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2, Edit2, ChevronDown, Check, Loader2 } from 'lucide-react';
import { updateLeadStatus, deleteLead, type LeadStatus } from './actions';
import { LeadEditModal, type LeadRecord } from './lead-edit-modal';
import { DeleteConfirmModal } from './delete-confirm-modal';

export const STATUS_OPTIONS: {
  value: LeadStatus;
  label: string;
  badgeClass: string;
  dotColor: string;
}[] = [
  {
    value: 'fresh_lead',
    label: 'Fresh Lead',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100/70',
    dotColor: 'bg-blue-500',
  },
  {
    value: 'follow_up',
    label: 'Follow-up',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/70',
    dotColor: 'bg-amber-500',
  },
  {
    value: 'interested',
    label: 'Interested',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70',
    dotColor: 'bg-emerald-500',
  },
  {
    value: 'not_interested',
    label: 'Not Interested',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/70',
    dotColor: 'bg-rose-500',
  },
  {
    value: 'enquired',
    label: 'Enquired',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100/70',
    dotColor: 'bg-purple-500',
  },
];

export function LeadStatusSelect({ id, status }: { id: string; status: LeadStatus }) {
  const [current, setCurrent] = useState<LeadStatus>(status);
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const currentConfig =
    STATUS_OPTIONS.find((o) => o.value === current) ?? {
      value: 'fresh_lead' as LeadStatus,
      label: 'Fresh Lead',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100/70',
      dotColor: 'bg-blue-500',
    };

  function toggleDropdown() {
    if (!isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < 200 && rect.top > 200);
    }
    setIsOpen((prev) => !prev);
  }

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

  function handleSelect(newStatus: LeadStatus) {
    setIsOpen(false);
    if (newStatus === current) return;
    const prev = current;
    setCurrent(newStatus);
    startTransition(async () => {
      const res = await updateLeadStatus(id, newStatus);
      if (res.error) {
        toast.error(res.error);
        setCurrent(prev);
        return;
      }
      toast.success('Status updated');
      router.refresh();
    });
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Custom Dropdown Trigger Badge */}
      <button
        type="button"
        disabled={isPending}
        onClick={toggleDropdown}
        className={`group inline-flex min-w-[135px] items-center justify-between gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-2xs transition focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-60 cursor-pointer whitespace-nowrap ${currentConfig.badgeClass}`}
      >
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className={`h-2 w-2 shrink-0 rounded-full ${currentConfig.dotColor}`} />
          <span className="whitespace-nowrap">{currentConfig.label}</span>
        </span>
        {isPending ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-ink-400 ml-auto" />
        ) : (
          <ChevronDown
            className={`h-3 w-3 shrink-0 transition-transform duration-200 ml-auto ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>

      {/* Floating Menu Popover (Upward or Downward) */}
      {isOpen && (
        <div
          className={`absolute left-0 z-50 min-w-[160px] w-max rounded-xl border border-ink-100 bg-white p-1.5 shadow-2xl animate-in fade-in-80 zoom-in-95 duration-150 ${
            openUpward ? 'bottom-full mb-1.5 origin-bottom-left' : 'top-full mt-1.5 origin-top-left'
          }`}
        >
          {STATUS_OPTIONS.map((opt) => {
            const isSelected = opt.value === current;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-ink-50 text-ink-900 font-semibold'
                    : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
                }`}
              >
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${opt.dotColor}`} />
                  <span className="whitespace-nowrap">{opt.label}</span>
                </span>
                {isSelected && <Check className="h-3.5 w-3.5 text-brand-600 ml-2 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function LeadRowActions({ lead, isAdmin }: { lead: LeadRecord; isAdmin: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  function executeDelete() {
    startTransition(async () => {
      const res = await deleteLead(lead.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Lead moved to trash');
      setIsDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => setIsEditOpen(true)}
          className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800 transition cursor-pointer"
          title="Edit lead"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setIsDeleteOpen(true)}
            disabled={isPending}
            className="rounded-lg p-1.5 text-coral-600 hover:bg-coral-50 disabled:opacity-50 transition cursor-pointer"
            title="Delete lead (soft-delete)"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Edit Modal */}
      {isEditOpen && (
        <LeadEditModal lead={lead} onClose={() => setIsEditOpen(false)} />
      )}

      {/* Delete Confirmation Modal Popup */}
      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        title="Delete Lead"
        description={`Are you sure you want to delete "${lead.contact_name}"? This record will be moved to trash and soft-deleted.`}
        confirmLabel="Yes, Delete"
        isPending={isPending}
        onConfirm={executeDelete}
        onClose={() => setIsDeleteOpen(false)}
      />
    </>
  );
}
