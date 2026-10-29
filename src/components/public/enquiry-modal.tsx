'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { EnquiryForm } from '@/components/public/enquiry-form';

/**
 * "Send Enquiry" modal for the package details page: the same form as the
 * Book With Us page, with the current package pre-selected and the signed-in
 * customer's name/email pre-filled.
 */
export function EnquiryModal({
  open,
  onClose,
  packageId,
  packageTitle,
  packages,
}: {
  open: boolean;
  onClose: () => void;
  packageId: string;
  packageTitle: string;
  packages?: { id: string; title: string }[];
}) {
  const [mounted, setMounted] = useState(false);
  const [customer, setCustomer] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => setMounted(true), []);

  // Make sure the current package is always in the dropdown list
  const packageOptions = useMemo(() => {
    const list = packages ?? [];
    return list.some((p) => p.id === packageId) ? list : [{ id: packageId, title: packageTitle }, ...list];
  }, [packages, packageId, packageTitle]);

  // Signed-in customer details (pages are cached, so this is loaded in the browser)
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch('/api/customer/me', { cache: 'no-store', credentials: 'same-origin', signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { name?: string | null; email?: string | null } | null) => {
        if (data?.email) setCustomer({ name: data.name ?? '', email: data.email });
        else setCustomer(null);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [open]);

  // Escape to close + lock page scroll while open
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black/50 p-3 backdrop-blur-xs sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Send enquiry"
        className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border-t-4 border-t-emerald-500 bg-white shadow-2xl sm:max-h-[calc(100dvh-3rem)]"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-ink-100 px-5 py-3 sm:px-6">
          <div>
            <h2 className="font-display text-lg font-bold text-ink-900">Send Enquiry</h2>
            <p className="mt-0.5 text-xs text-ink-500">
              Share a few details and our team will reach out with a tailored itinerary and quote.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Compact form fits the modal; on very short screens it can still scroll (scrollbar hidden) */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:px-6">
          <EnquiryForm
            buttonLabel="Send Quote"
            isLoggedIn={Boolean(customer)}
            defaultName={customer?.name || ''}
            defaultEmail={customer?.email || ''}
            packageId={packageId}
            layout="split"
            compact
            availablePackages={packageOptions}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
