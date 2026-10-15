'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel = 'Yes, Delete',
  isPending = false,
  onConfirm,
  onClose,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-ink-100 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 border border-red-100">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-ink-900">{title}</h3>
            <p className="mt-1.5 text-xs text-ink-500 leading-relaxed">{description}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-ink-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="btn-outline text-xs px-4 py-2 font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50 transition cursor-pointer"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
