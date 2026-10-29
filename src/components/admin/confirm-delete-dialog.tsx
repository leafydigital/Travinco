'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmDeleteDialogProps {
  title?: string;
  description: React.ReactNode;
  isOpen: boolean;
  isPending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  confirmLabel?: string;
  maxWidth?: string | number;
}

const widthMap: Record<string, string> = {
  'max-w-xs': '320px',
  'max-w-sm': '384px',
  'max-w-md': '420px',
  'max-w-lg': '480px',
};

export function ConfirmDeleteDialog({
  title = 'Confirm Delete',
  description,
  isOpen,
  isPending = false,
  onConfirm,
  onClose,
  confirmLabel = 'Delete',
  maxWidth,
}: ConfirmDeleteDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // Prevent body scroll when modal is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isPending, onClose]);

  if (!isOpen || !mounted) return null;

  // Resolve rigid max-width so modal never expands to full-width
  const resolvedMaxWidth =
    (typeof maxWidth === 'string' && widthMap[maxWidth]) ||
    (typeof maxWidth === 'number' ? `${maxWidth}px` : null) ||
    (typeof maxWidth === 'string' && maxWidth.includes('px')
      ? maxWidth.replace(/max-w-\[?|\]/g, '')
      : '400px');

  const dialogContent = (
    <div
      className="fixed inset-0 bg-ink-950/50 z-[9999] flex items-center justify-center overflow-y-auto overflow-x-hidden p-4 transition-opacity animate-in fade-in duration-150 print:hidden"
      onClick={() => {
        if (!isPending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ maxWidth: resolvedMaxWidth }}
        className="relative w-full mx-auto overflow-hidden rounded-2xl border border-ink-100 bg-white p-5 sm:p-6 shadow-lg shadow-ink-900/5 transition-all animate-in zoom-in-95 duration-150 box-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Danger Badge Icon, Title, and Close Button */}
        <div className="flex items-start justify-between gap-3 border-b border-ink-100 pb-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-coral-50 border border-coral-200/80 text-coral-600 shadow-2xs">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-sans text-base font-bold tracking-tight text-ink-900 leading-snug truncate">
                {title}
              </h3>
              <p className="text-xs text-ink-500 mt-0.5">Please confirm to proceed</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 disabled:opacity-50 transition cursor-pointer -mr-1 -mt-1 shrink-0"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
  
        {/* Formatted Description Body */}
        <div className="py-4 text-sm text-ink-700 leading-relaxed text-left break-words">
          {description}
        </div>
  
        {/* Responsive Footer Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 border-t border-ink-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="btn-outline w-full sm:w-auto px-4 py-2 text-xs font-semibold justify-center transition cursor-pointer rounded-xl"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="btn-danger w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold shadow-xs transition cursor-pointer rounded-xl bg-coral-600 hover:bg-coral-700 text-white"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{isPending ? 'Deleting…' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
}
