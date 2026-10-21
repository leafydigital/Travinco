'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Save, X, AlertCircle } from 'lucide-react';

interface PendingSaveAction {
  element: HTMLElement;
  label: string;
  isFormSubmit?: boolean;
  form?: HTMLFormElement;
}

/**
 * Global Save Confirmation Provider for all Admin Dashboard pages.
 * Listens for save button clicks and form submissions across the dashboard
 * and prompts the admin with a confirmation popup before executing the save.
 */
export function SaveConfirmationProvider({ children }: { children?: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [actionInfo, setActionInfo] = useState<{ title: string; description: string }>({
    title: 'Confirm Save Changes',
    description: 'Are you sure you want to save these changes?',
  });
  const pendingActionRef = useRef<PendingSaveAction | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = useCallback(() => {
    pendingActionRef.current = null;
    setIsOpen(false);
  }, []);

  const handleConfirm = useCallback(() => {
    const pending = pendingActionRef.current;
    if (!pending) {
      setIsOpen(false);
      return;
    }

    if (pending.isFormSubmit && pending.form) {
      pending.form.dataset.confirmedSave = 'true';
      if (typeof pending.form.requestSubmit === 'function') {
        pending.form.requestSubmit(
          pending.element instanceof HTMLButtonElement || pending.element instanceof HTMLInputElement
            ? pending.element
            : undefined
        );
      } else {
        pending.form.submit();
      }
      setTimeout(() => {
        if (pending.form) delete pending.form.dataset.confirmedSave;
      }, 200);
    } else if (pending.element) {
      pending.element.dataset.confirmedSave = 'true';
      pending.element.click();
      setTimeout(() => {
        if (pending.element) delete pending.element.dataset.confirmedSave;
      }, 200);
    }

    pendingActionRef.current = null;
    setIsOpen(false);
  }, []);

  // Intercept clicks on Save buttons at capture phase
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Find closest button or submit input
      const button = target.closest<HTMLButtonElement | HTMLInputElement>(
        'button, input[type="submit"]'
      );
      if (!button) return;

      // If already confirmed, let the click proceed to native/React handler
      if (button.dataset.confirmedSave === 'true') {
        return;
      }

      // If inside our own confirmation modal, ignore
      if (button.closest('#global-save-confirmation-dialog')) {
        return;
      }

      // If button has explicit opt-out
      if (button.dataset.noConfirmSave === 'true') {
        return;
      }

      // Ignore disabled buttons or loading state
      if (button.disabled || button.getAttribute('aria-disabled') === 'true') {
        return;
      }

      // Check text / labels / titles for "save"
      const text = (button.innerText || button.textContent || button.value || '').trim();
      const aria = button.getAttribute('aria-label') || '';
      const title = button.getAttribute('title') || '';
      const combined = `${text} ${aria} ${title}`.toLowerCase();

      // Ignore if already saving
      if (/\bsaving\b/i.test(combined) && !/\bsave\b/i.test(combined)) {
        return;
      }

      // Must have "save" as a standalone word
      const hasSaveWord = /\bsave\b/i.test(combined);

      // Exclude cancel, delete, discard, remove, close
      const isNegativeOrDelete = /\b(cancel|delete|remove|discard|close|exit|back)\b/i.test(combined);

      if (!hasSaveWord || isNegativeOrDelete) {
        return;
      }

      // Stop original click immediately
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Determine human-friendly description
      let displayContext = text.replace(/^save\s*/i, '').trim();
      if (!displayContext || displayContext.length > 50) {
        displayContext = 'these changes';
      }

      const modalTitle = text && text.length < 40 ? text : 'Save Changes';
      const descriptionText =
        displayContext === 'these changes'
          ? 'Are you sure you want to save your changes? Any updates made will be applied immediately.'
          : `Are you sure you want to save "${displayContext}"? Any updates made will be applied immediately.`;

      pendingActionRef.current = {
        element: button,
        label: text,
      };

      setActionInfo({
        title: modalTitle,
        description: descriptionText,
      });

      setIsOpen(true);
    };

    // Capture phase intercepts before component onClick handlers
    document.addEventListener('click', handleDocumentClick, true);

    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, []);

  // Intercept form submissions (e.g. Enter key pressed in an input)
  useEffect(() => {
    const handleDocumentSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      if (!form) return;

      if (form.dataset.confirmedSave === 'true') {
        return;
      }

      if (form.closest('#global-save-confirmation-dialog')) {
        return;
      }

      const submitter =
        (e.submitter as HTMLElement | null) ||
        form.querySelector<HTMLButtonElement | HTMLInputElement>('button[type="submit"], input[type="submit"]');

      const text = submitter
        ? (submitter.innerText || submitter.textContent || (submitter as HTMLInputElement).value || '').trim()
        : '';
      const combined = text.toLowerCase();

      if (/\bsave\b/i.test(combined)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        let displayContext = text.replace(/^save\s*/i, '').trim();
        if (!displayContext || displayContext.length > 50) {
          displayContext = 'these changes';
        }

        pendingActionRef.current = {
          element: submitter || form,
          label: text || 'Save changes',
          isFormSubmit: true,
          form: form,
        };

        setActionInfo({
          title: text && text.length < 40 ? text : 'Save Changes',
          description: `Are you sure you want to save ${displayContext === 'these changes' ? 'your changes' : `"${displayContext}"`}? Any updates made will be applied immediately.`,
        });

        setIsOpen(true);
      }
    };

    document.addEventListener('submit', handleDocumentSubmit, true);
    return () => {
      document.removeEventListener('submit', handleDocumentSubmit, true);
    };
  }, []);

  // Keyboard shortcut listener (Esc to close, Enter to confirm)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, handleClose, handleConfirm]);

  return (
    <>
      {children}

      {/* ── Global Save Confirmation Modal Dialog ── */}
      {mounted &&
        isOpen &&
        createPortal(
          <div
            id="global-save-confirmation-dialog"
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-xs select-none animate-in fade-in duration-150"
            onClick={handleClose}
            role="dialog"
            aria-modal="true"
            aria-label="Save Confirmation"
          >
            <div
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-brand-200/80 animate-in zoom-in-95 duration-150 p-6 sm:p-7 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with Save Icon & Close button */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 border border-brand-200/80 text-brand-700 shadow-xs">
                    <Save className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-base sm:text-lg font-bold text-ink-950 tracking-tight leading-snug">
                      {actionInfo.title}
                    </h3>
                    <p className="text-xs text-brand-700 font-semibold mt-0.5 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Confirmation Required
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-ink-600 hover:bg-ink-200 hover:text-ink-900 transition cursor-pointer focus:outline-hidden"
                  aria-label="Cancel and close dialog"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Message Body */}
              <div className="rounded-2xl bg-sand-50/70 border border-sand-200/80 p-4">
                <p className="text-xs sm:text-sm text-ink-700 leading-relaxed font-medium">
                  {actionInfo.description}
                </p>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-xs font-semibold text-ink-700 hover:bg-ink-50 transition shadow-2xs cursor-pointer focus:outline-hidden"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirm}
                  autoFocus
                  className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold shadow-sm cursor-pointer focus:outline-hidden"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Yes, Save Changes</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
