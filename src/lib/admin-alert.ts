'use client';

/**
 * Admin dashboard notifications — SweetAlert2 popups instead of snackbar toasts.
 *
 * Exposes the same `toast.success / error / info / warning / message` surface
 * that the dashboard used with `sonner`, so call sites only swap the import.
 * SweetAlert2 is loaded lazily so it never weighs on the initial bundle.
 */

import type { SweetAlertIcon, SweetAlertOptions } from 'sweetalert2';

type SwalModule = typeof import('sweetalert2').default;

let swalPromise: Promise<SwalModule> | null = null;
export function loadSwal(): Promise<SwalModule> {
  if (!swalPromise) swalPromise = import('sweetalert2').then((m) => m.default);
  return swalPromise;
}

const BRAND = '#0f766e';
const DANGER = '#dc2626';

const baseOptions: SweetAlertOptions = {
  confirmButtonColor: BRAND,
  cancelButtonColor: '#64748b',
  buttonsStyling: true,
  customClass: { container: 'tv-swal', popup: 'tv-swal-popup' },
};

type NotifyOptions = {
  description?: string;
  /** Auto-close after this many ms (successes/infos only). */
  duration?: number;
  /** Stay open until the user clicks OK (no auto-close). */
  persistent?: boolean;
} & Record<string, unknown>;

/** Shows a popup and resolves once it has closed (OK clicked, timer ran out or dismissed). */
function show(icon: SweetAlertIcon | undefined, message: unknown, opts?: NotifyOptions): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const text = typeof message === 'string' ? message : String(message ?? '');
  const isError = icon === 'error' || icon === 'warning';
  // Every popup stays open until the user clicks "OK" (no auto-close),
  // unless a caller explicitly asks for one with `duration`.
  const timer = isError || opts?.persistent ? undefined : opts?.duration;
  return loadSwal()
    .then((Swal) =>
      Swal.fire({
        ...baseOptions,
        icon,
        title: text,
        text: opts?.description,
        timer,
        timerProgressBar: Boolean(timer),
        // Clicking outside or pressing Esc doesn't dismiss it — only OK does
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: true,
        confirmButtonText: 'OK',
        confirmButtonColor: icon === 'error' ? DANGER : BRAND,
      })
    )
    .then(() => undefined);
}

export const toast = {
  success: (message: unknown, opts?: NotifyOptions) => show('success', message, opts),
  error: (message: unknown, opts?: NotifyOptions) => show('error', message, opts),
  info: (message: unknown, opts?: NotifyOptions) => show('info', message, opts),
  warning: (message: unknown, opts?: NotifyOptions) => show('warning', message, opts),
  message: (message: unknown, opts?: NotifyOptions) => show('info', message, opts),
};

/** Promise-based confirm popup. Resolves `true` when the user confirms. */
export async function confirmAlert({
  title,
  text,
  confirmText = 'Yes',
  cancelText = 'Cancel',
  icon = 'question',
  danger = false,
  confirmColor,
  cancelColor,
}: {
  title: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: SweetAlertIcon;
  danger?: boolean;
  confirmColor?: string;
  cancelColor?: string;
}): Promise<boolean> {
  const Swal = await loadSwal();
  const res = await Swal.fire({
    ...baseOptions,
    icon,
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: confirmColor ?? (danger ? DANGER : BRAND),
    ...(cancelColor ? { cancelButtonColor: cancelColor } : {}),
    reverseButtons: true,
    focusConfirm: true,
  });
  return res.isConfirmed;
}
