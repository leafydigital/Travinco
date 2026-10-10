'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
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
      <div className="flex items-center justify-end gap-1.5">
        <Link
          href={`/admin/invoices/${id}`}
          className="btn-outline h-8 px-3 text-xs text-brand-700 hover:bg-brand-50"
        >
          View &amp; Print
        </Link>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={isPending}
            className="btn-ghost h-8 px-2 text-xs text-coral-600 hover:bg-coral-50 hover:text-coral-700 disabled:opacity-50"
            title="Delete invoice"
          >
            <Trash2 className="h-3.5 w-3.5 sm:mr-1 inline" />
            <span>Delete</span>
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
            action will permanently remove it and any associated payment records
            from the database. This cannot be undone.
          </>
        }
        onConfirm={handleDelete}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
