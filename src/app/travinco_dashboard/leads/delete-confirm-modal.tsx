'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

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

  const content = (
    <div
      className="fixed inset-0 bg-ink-950/50 z-[9999] flex items-center justify-center p-4 transition-opacity animate-in fade-in duration-150"
      onClick={() => {
        if (!isPending) onClose();
      }}
    >
      <div
        className="relative w-full mx-auto rounded-2xl bg-white p-5 sm:p-6 shadow-lg shadow-ink-900/5 border border-ink-100 animate-in zoom-in-95 duration-150 box-border"
        style={{ maxWidth: '400px' }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 border border-red-100 shadow-2xs">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-sans text-base font-bold text-ink-900 leading-snug">{title}</h3>
            <p className="mt-1.5 text-xs text-ink-500 leading-relaxed break-words">{description}</p>
          </div>
        </div>
  
        <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-ink-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="btn-outline text-xs px-4 py-2 font-semibold rounded-xl"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50 transition cursor-pointer"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
