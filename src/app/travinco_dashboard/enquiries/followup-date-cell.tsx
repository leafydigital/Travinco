'use client';

import { useState, useTransition, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Calendar, X, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { updateEnquiryFollowupDate } from './actions';
import { formatDate } from '@/lib/utils/format';

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
  const [selectedDate, setSelectedDate] = useState(currentDate ?? '');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const isToday = currentDate === todayStr;
  const isResolved = ['confirmed', 'lost', 'closed'].includes(status);
  const isOverdue = Boolean(currentDate && currentDate < todayStr && !isResolved);

  // Sync selectedDate with currentDate prop
  useEffect(() => {
    setSelectedDate(currentDate ?? '');
  }, [currentDate]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPending]);

  function handleSave(dateToSave: string | null) {
    startTransition(async () => {
      const result = await updateEnquiryFollowupDate(enquiryId, dateToSave);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(dateToSave ? `Follow-up set to ${dateToSave}` : 'Follow-up date cleared');
        setIsOpen(false);
        router.refresh();
      }
    });
  }

  function handleQuickSet(offsetDays: number) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const dateStr = d.toISOString().slice(0, 10);
    setSelectedDate(dateStr);
    handleSave(dateStr);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={isPending}
        className={`group flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-colors cursor-pointer ${
          isOverdue
            ? 'bg-rose-50 text-rose-700 font-semibold border border-rose-200 hover:bg-rose-100'
            : isToday
            ? 'bg-amber-50 text-amber-800 font-semibold border border-amber-200 hover:bg-amber-100'
            : currentDate
            ? 'bg-ink-50 text-ink-700 font-medium border border-ink-200/80 hover:bg-ink-100'
            : 'border border-dashed border-ink-200 text-ink-400 hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50/50'
        }`}
        title="Click to set or change follow-up date"
      >
        <Calendar className="h-3.5 w-3.5 shrink-0 opacity-70 group-hover:opacity-100" />
        <span>
          {currentDate ? (
            <>
              {formatDate(currentDate)}
              {isToday && <span className="ml-1 text-[10px] font-bold text-amber-700">(Today)</span>}
              {isOverdue && <span className="ml-1 text-[10px] font-bold text-rose-600">(Overdue)</span>}
            </>
          ) : (
            <span className="italic">+ Set follow-up</span>
          )}
        </span>
      </button>

      {/* Portal Modal Dialog — Rendered at document.body level so it NEVER gets clipped by table/card overflow */}
      {isOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-navy-950/45 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
            onClick={() => !isPending && setIsOpen(false)}
          />

          {/* Modal Content */}
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-ink-200 bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
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
                <button
                  type="button"
                  onClick={() => handleQuickSet(0)}
                  disabled={isPending}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition text-center"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSet(1)}
                  disabled={isPending}
                  className="rounded-lg border border-ink-200 bg-ink-50 px-2 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-100 transition text-center"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSet(3)}
                  disabled={isPending}
                  className="rounded-lg border border-ink-200 bg-ink-50 px-2 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-100 transition text-center"
                >
                  In 3 days
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSet(7)}
                  disabled={isPending}
                  className="rounded-lg border border-ink-200 bg-ink-50 px-2 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-100 transition text-center"
                >
                  In 1 week
                </button>
              </div>
            </div>

            {/* Date Input */}
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-600">Custom follow-up date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  disabled={isPending}
                  className="input w-full text-sm"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-ink-100">
                {currentDate ? (
                  <button
                    type="button"
                    onClick={() => handleSave(null)}
                    disabled={isPending}
                    className="text-xs font-medium text-rose-600 hover:text-rose-800 hover:underline"
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
                    className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
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
