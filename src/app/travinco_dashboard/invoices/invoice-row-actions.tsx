'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/admin-alert';
import { Printer, Trash2 } from 'lucide-react';
import { deleteInvoice } from './actions';
import { ConfirmDeleteDialog } from '@/components/admin/confirm-delete-dialog';

interface InvoiceRowActionsProps {
  id: string;
  invoiceNumber: string;
  isAdmin: boolean;
}

export function InvoiceRowActions({
  id,
  invoiceNumber,
  isAdmin,
}: InvoiceRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteInvoice(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Invoice deleted successfully');
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap">
        <Link
          href={`/travinco_dashboard/invoices/${id}`}
          prefetch={true}
          className="btn-outline h-8 shrink-0 gap-1 whitespace-nowrap px-2.5 text-xs text-brand-700 hover:bg-brand-50"
          title="View & Print invoice"
        >
          <Printer className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">View &amp; Print</span>
        </Link>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={isPending}
            className="btn-ghost h-8 shrink-0 whitespace-nowrap px-2 text-xs text-coral-600 hover:bg-coral-50 hover:text-coral-700 disabled:opacity-50"
            title="Delete invoice"
          >
            <Trash2 className="h-3.5 w-3.5 sm:mr-1 inline" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        )}
      </div>

      <ConfirmDeleteDialog
        isOpen={confirmOpen}
        isPending={isPending}
        title="Delete Invoice"
        description={
          <>
            Are you sure you want to delete invoice{' '}
            <strong className="text-ink-900">{invoiceNumber}</strong>? This
            action will remove it from the active invoices list.
          </>
        }
        onConfirm={handleDelete}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
