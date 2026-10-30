'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/admin-alert';
import { ChevronDown, Check, Loader2 } from 'lucide-react';
import { updateEnquiryStatus } from './actions';
import type { EnquiryStatus } from '@/types/database';
import { StatusBadge } from '@/components/ui/status-badge';
import { ENQUIRY_STATUS_OPTIONS, normalizeEnquiryStatus } from '@/lib/enquiry-status';

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
  const [current, setCurrent] = useState<EnquiryStatus>(normalizeEnquiryStatus(currentStatus));
  const [isOpen, setIsOpen] = useState(false);
  // Fixed-position menu (rendered in <body>) so a scrolling table can't clip it
  const [menuPos, setMenuPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync state if prop changes from parent / router refresh
  useEffect(() => {
    setCurrent(normalizeEnquiryStatus(currentStatus));
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

  const activeConfig = ENQUIRY_STATUS_OPTIONS.find((o) => o.value === current) ?? ENQUIRY_STATUS_OPTIONS[0]!;

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (dropdownRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    function close() {
      setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // The menu is fixed to the screen, so close it rather than leave it floating
      window.addEventListener('scroll', close, true);
      window.addEventListener('resize', close);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [isOpen]);

  function toggleDropdown() {
    if (!canEdit) return;
    if (!isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const menuW = Math.min(240, window.innerWidth - 16);
      const menuH = 230;
      const spaceBelow = window.innerHeight - rect.bottom;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuW - 8));
      setMenuPos(
        spaceBelow < menuH && rect.top > spaceBelow
          ? { left, bottom: window.innerHeight - rect.top + 6 }
          : { left, top: rect.bottom + 6 }
      );
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
    return <StatusBadge status={current} className="max-w-[11.5rem] rounded-2xl leading-tight" />;
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={toggleDropdown}
        disabled={isPending}
        title="Click to change enquiry status"
        className={`inline-flex max-w-[11.5rem] items-center gap-1.5 rounded-2xl px-3 py-1 text-left text-xs font-semibold leading-tight border transition-all cursor-pointer shadow-2xs hover:shadow-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 ${activeConfig.badgeClass}`}
      >
        <span className={`h-2 w-2 rounded-full shrink-0 ${activeConfig.dotColor}`} />
        <span className="min-w-0">{activeConfig.label}</span>
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

      {isOpen && menuPos && createPortal(
        <div
          ref={menuRef}
          style={{ left: menuPos.left, top: menuPos.top, bottom: menuPos.bottom }}
          className="fixed z-[60] w-60 max-w-[calc(100vw-1rem)] rounded-2xl border border-ink-200/90 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150"
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
        </div>,
        document.body
      )}
    </div>
  );
}
