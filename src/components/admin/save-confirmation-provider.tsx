'use client';

import React, { useEffect, useCallback, useRef } from 'react';
import { confirmAlert } from '@/lib/admin-alert';

interface PendingSaveAction {
  element: HTMLElement;
  label: string;
  isFormSubmit?: boolean;
  form?: HTMLFormElement;
}

/** Words that just mean "the changes" — the popup then reads naturally without quoting them. */
const GENERIC_CONTEXT = /^(changes?|all changes|details|information|info|data|it|now)$/i;

/** "Save Package Info" → 'Are you sure you want to save "Package Info"? …'; "Save Changes" → generic wording. */
function describeSave(buttonText: string, confirmLabel?: string) {
  const tail = 'Any updates made will be applied immediately.';
  if (confirmLabel) return `Are you sure you want to ${confirmLabel.toLowerCase()}?`;
  const context = buttonText.replace(/^save\s*/i, '').trim();
  if (!context || context.length > 50 || GENERIC_CONTEXT.test(context)) {
    return `Are you sure you want to save? ${tail}`;
  }
  return `Are you sure you want to save "${context}"? ${tail}`;
}

/**
 * Global Save Confirmation Provider for all Admin Dashboard pages.
 * Listens for save button clicks and form submissions across the dashboard
 * and prompts the admin with a SweetAlert confirmation popup before executing the save.
 */
export function SaveConfirmationProvider({ children }: { children?: React.ReactNode }) {
  const pendingActionRef = useRef<PendingSaveAction | null>(null);
  const openRef = useRef(false);

  const handleConfirm = useCallback(() => {
    const pending = pendingActionRef.current;
    if (!pending) return;

    const targetEl = pending.element;
    const targetForm =
      pending.form ||
      (targetEl instanceof HTMLButtonElement || targetEl instanceof HTMLInputElement
        ? targetEl.form ||
          (targetEl.getAttribute('form')
            ? (document.getElementById(targetEl.getAttribute('form')!) as HTMLFormElement | null)
            : null)
        : null);

    // Mark confirmedSave flag on both element and form
    if (targetEl) targetEl.dataset.confirmedSave = 'true';
    if (targetForm) targetForm.dataset.confirmedSave = 'true';

    const isSubmitAction =
      pending.isFormSubmit ||
      (targetEl &&
        (targetEl as HTMLButtonElement).type === 'submit' &&
        Boolean(targetForm));

    if (targetForm && isSubmitAction) {
      const isDescendant = Boolean(targetEl && targetForm.contains(targetEl));
      const submitter =
        isDescendant &&
        (targetEl instanceof HTMLButtonElement || targetEl instanceof HTMLInputElement)
          ? targetEl
          : undefined;

      let submitted = false;
      if (typeof targetForm.requestSubmit === 'function') {
        try {
          targetForm.requestSubmit(submitter);
          submitted = true;
        } catch {
          try {
            targetForm.requestSubmit();
            submitted = true;
          } catch {
            // will fallback below
          }
        }
      }

      if (!submitted) {
        // Dispatch synthetic submit event for React 18 form handlers
        const submitEvt = new Event('submit', { bubbles: true, cancelable: true });
        targetForm.dispatchEvent(submitEvt);
      }
    } else if (targetEl) {
      targetEl.click();
    }

    setTimeout(() => {
      if (targetEl) delete targetEl.dataset.confirmedSave;
      if (targetForm) delete targetForm.dataset.confirmedSave;
    }, 1200);

    pendingActionRef.current = null;
  }, []);

  const openConfirm = useCallback(
    (info: { title: string; description: string; confirmText?: string }) => {
      if (openRef.current) return;
      openRef.current = true;
      void confirmAlert({
        title: info.title,
        text: info.description,
        confirmText: info.confirmText || 'Yes, save changes',
        cancelText: 'Cancel',
        confirmColor: '#16a34a', // green
        cancelColor: '#dc2626', // red
      }).then((ok) => {
        openRef.current = false;
        if (ok) handleConfirm();
        else pendingActionRef.current = null;
      });
    },
    [handleConfirm]
  );

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

      // Find associated form if any
      const form =
        button.form ||
        (button.getAttribute('form')
          ? (document.getElementById(button.getAttribute('form')!) as HTMLFormElement | null)
          : null) ||
        button.closest('form');

      // If already confirmed, let the click proceed to native/React handler
      if (
        button.dataset.confirmedSave === 'true' ||
        (form && form.dataset.confirmedSave === 'true')
      ) {
        return;
      }

      // If inside a SweetAlert popup (our own confirmation), ignore
      if (button.closest('.swal2-container')) {
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

      // Must have "save" as a standalone word, or opt in with data-confirm-save (e.g. "Update")
      const hasSaveWord = /\bsave\b/i.test(combined) || button.dataset.confirmSave === 'true';

      // Exclude cancel, delete, discard, remove, close
      const isNegativeOrDelete = /\b(cancel|delete|remove|discard|close|exit|back)\b/i.test(combined);

      if (!hasSaveWord || isNegativeOrDelete) {
        return;
      }

      // Stop original click immediately
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const isSubmitButton =
        button.type === 'submit' ||
        (form !== null && button.getAttribute('type') !== 'button');

      const confirmLabel = button.dataset.confirmLabel;
      const modalTitle = confirmLabel || (text && text.length < 40 ? text : 'Save Changes');
      const descriptionText = describeSave(text, confirmLabel);

      pendingActionRef.current = {
        element: button,
        label: text,
        isFormSubmit: Boolean(isSubmitButton && form),
        form: form || undefined,
      };

      openConfirm({
        title: modalTitle,
        description: descriptionText,
        confirmText: confirmLabel,
      });
    };

    // Capture phase intercepts before component onClick handlers
    document.addEventListener('click', handleDocumentClick, true);

    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [openConfirm]);

  // Intercept form submissions (e.g. Enter key pressed in an input)
  useEffect(() => {
    const handleDocumentSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      if (!form) return;

      if (form.dataset.confirmedSave === 'true') {
        return;
      }

      if (
        e.submitter &&
        (e.submitter as HTMLElement).dataset?.confirmedSave === 'true'
      ) {
        form.dataset.confirmedSave = 'true';
        return;
      }

      if (form.closest('.swal2-container')) {
        return;
      }

      const submitter =
        (e.submitter as HTMLElement | null) ||
        form.querySelector<HTMLButtonElement | HTMLInputElement>('button[type="submit"], input[type="submit"]');

      const text = submitter
        ? (submitter.innerText || submitter.textContent || (submitter as HTMLInputElement).value || '').trim()
        : '';
      const combined = text.toLowerCase();

      const confirmLabel = (submitter as HTMLElement | null)?.dataset?.confirmLabel;
      if (/\bsave\b/i.test(combined) || (submitter as HTMLElement | null)?.dataset?.confirmSave === 'true') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        pendingActionRef.current = {
          element: submitter || form,
          label: text || 'Save changes',
          isFormSubmit: true,
          form: form,
        };

        openConfirm({
          title: confirmLabel || (text && text.length < 40 ? text : 'Save Changes'),
          description: describeSave(text, confirmLabel),
          confirmText: confirmLabel,
        });
      }
    };

    document.addEventListener('submit', handleDocumentSubmit, true);
    return () => {
      document.removeEventListener('submit', handleDocumentSubmit, true);
    };
  }, [openConfirm]);

  return <>{children}</>;
}
