'use client';

import { useEffect } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmDeleteDialogProps {
  title?: string;
  description: React.ReactNode;
  isOpen: boolean;
  isPending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  confirmLabel?: string;
}

export function ConfirmDeleteDialog({
  title = 'Confirm Delete',
  description,
  isOpen,
  isPending = false,
  onConfirm,
  onClose,
  confirmLabel = 'Delete',
}: ConfirmDeleteDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPending, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink-900/50 p-4 backdrop-blur-sm print:hidden"
      onClick={() => {
        if (!isPending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card w-full max-w-md bg-white p-6 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-coral-100 text-coral-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-ink-900">{title}</h3>
            <div className="mt-2 text-sm text-ink-600 leading-relaxed break-words">
              {description}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="btn-outline px-4 py-2 text-xs font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="btn-danger flex items-center gap-1.5 px-4 py-2 text-xs font-medium"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isPending ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
