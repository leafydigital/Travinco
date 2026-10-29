'use client';

import { useState, useTransition, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Calendar, X, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { updateEnquiryFollowupDate } from './actions';
import { formatDate } from '@/lib/utils/format';
import { DatePickerDMY, formatIsoAsDMY } from '@/components/public/date-picker-dmy';
import { addYearsIso, todayIso } from '@/lib/utils/iso-date';

export function FollowupDateCell({
  enquiryId,
  customerName,
  enquiryNumber,
  currentDate,
  status,
}: {
  enquiryId: string;
  customerName?: string;
  enquiryNumber?: string;
  currentDate: string | null;
  status: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [displayedDate, setDisplayedDate] = useState<string | null>(currentDate);
  const [mounted, setMounted] = useState(false);

  const todayStr = todayIso();
  const maxDateStr = addYearsIso(todayStr, 1);
  const [selectedDate, setSelectedDate] = useState<string>(currentDate ?? todayStr);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync with prop when server data changes
  useEffect(() => {
    setDisplayedDate(currentDate);
  }, [currentDate]);

  function getPresetDate(offsetDays: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  const presets = [
    { label: 'Today', date: getPresetDate(0) },
    { label: 'Tomorrow', date: getPresetDate(1) },
    { label: 'In 3 days', date: getPresetDate(3) },
    { label: 'In 1 week', date: getPresetDate(7) },
  ];

  function handleOpen() {
    setSelectedDate(displayedDate || todayStr);
    setIsOpen(true);
  }

  const isToday = displayedDate === todayStr;
  const isResolved = ['confirmed', 'lost', 'closed'].includes(status);
  const isOverdue = Boolean(displayedDate && displayedDate < todayStr && !isResolved);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  function handleSave(dateToSave: string | null) {
    if (dateToSave && dateToSave < todayStr) {
      toast.error('Follow-up date cannot be in the past.');
      return;
    }
    if (dateToSave && dateToSave > maxDateStr) {
      toast.error('Follow-up date must be within 1 year from today.');
      return;
    }

    const previousDate = displayedDate;
    // Optimistic UI: reflect in table immediately and close modal
    setDisplayedDate(dateToSave);
    setIsOpen(false);
    toast.success(dateToSave ? `Follow-up set to ${formatIsoAsDMY(dateToSave)}` : 'Follow-up date cleared');

    startTransition(async () => {
      const result = await updateEnquiryFollowupDate(enquiryId, dateToSave);
      if (result.error) {
        // Rollback on server error
        setDisplayedDate(previousDate);
        toast.error(result.error);
      }
    });
  }

  function handleQuickSet(dateStr: string) {
    // Only update local selection & input — DO NOT auto-save!
    setSelectedDate(dateStr);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`group flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-colors cursor-pointer ${
          isOverdue
            ? 'bg-rose-50 text-rose-700 font-semibold border border-rose-200 hover:bg-rose-100'
            : isToday
            ? 'bg-amber-50 text-amber-800 font-semibold border border-amber-200 hover:bg-amber-100'
            : displayedDate
            ? 'bg-ink-50 text-ink-700 font-medium border border-ink-200/80 hover:bg-ink-100'
            : 'border border-dashed border-ink-200 text-ink-400 hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50/50'
        }`}
        title="Click to set or change follow-up date"
      >
        <Calendar className="h-3.5 w-3.5 shrink-0 opacity-70 group-hover:opacity-100" />
        <span>
          {displayedDate ? (
            <>
              {formatDate(displayedDate)}
              {isToday && <span className="ml-1 text-[10px] font-bold text-amber-700">(Today)</span>}
              {isOverdue && <span className="ml-1 text-[10px] font-bold text-rose-600">(Overdue)</span>}
            </>
          ) : (
            <span className="italic">+ Set follow-up</span>
          )}
        </span>
      </button>

      {/* Portal Modal Dialog — Rendered at document.body level */}
      {isOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-ink-950/50 transition-opacity animate-in fade-in duration-150"
            onClick={() => !isPending && setIsOpen(false)}
          />
  
          {/* Modal Content */}
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-ink-200 bg-white p-5 shadow-lg shadow-ink-900/5 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="mb-4 flex items-start justify-between border-b border-ink-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700 border border-brand-200/60">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink-900">Set Follow-up Date</h3>
                  {(customerName || enquiryNumber) && (
                    <p className="text-xs text-ink-500">
                      {customerName} {enquiryNumber ? `(${enquiryNumber})` : ''}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
  
            {/* Quick Presets */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-ink-600">Quick presets</label>
              <div className="grid grid-cols-4 gap-1.5">
                {presets.map((p) => {
                  const isSelected = selectedDate === p.date;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleQuickSet(p.date)}
                      disabled={isPending}
                      className={`rounded-lg border px-2 py-1.5 text-xs transition text-center cursor-pointer ${
                        isSelected
                          ? 'border-brand-500 bg-brand-50 text-brand-900 font-semibold ring-1 ring-brand-500 shadow-2xs'
                          : 'border-ink-200 bg-ink-50/70 text-ink-700 hover:bg-ink-100 hover:border-ink-300 font-medium'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
  
            {/* Date Input */}
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-600">Custom follow-up date</label>
                <DatePickerDMY
                  value={selectedDate}
                  min={todayStr}
                  max={maxDateStr}
                  onChange={setSelectedDate}
                />
              </div>
  
              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-ink-100">
                {displayedDate ? (
                  <button
                    type="button"
                    onClick={() => handleSave(null)}
                    disabled={isPending}
                    className="text-xs font-medium text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                  >
                    Clear date
                  </button>
                ) : (
                  <span />
                )}
  
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    disabled={isPending}
                    className="btn-outline px-3 py-1.5 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSave(selectedDate || null)}
                    disabled={isPending || !selectedDate}
                    className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer"
                  >
                    {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>{isPending ? 'Saving…' : 'Save Date'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
