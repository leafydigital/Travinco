'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { deleteQuotation } from './actions';
import { ConfirmDeleteDialog } from '@/components/admin/confirm-delete-dialog';

interface QuoteRowActionsProps {
  id: string;
  quoteNumber: string;
  isLocked: boolean;
  isAdmin: boolean;
}

export function QuoteRowActions({
  id,
  quoteNumber,
  isLocked,
  isAdmin,
}: QuoteRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteQuotation(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Quotation deleted successfully');
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        {!isLocked && (
          <Link
            href={`/admin/quotations/${id}/edit`}
            className="btn-outline h-8 px-2.5 text-xs text-brand-700 hover:bg-brand-50"
          >
            Edit
          </Link>
        )}
        <Link
          href={`/admin/quotations/${id}`}
          className="btn-ghost h-8 px-2 text-xs text-ink-500 hover:text-ink-900"
        >
          View
        </Link>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={isPending}
            className="btn-ghost h-8 px-2 text-xs text-coral-600 hover:bg-coral-50 hover:text-coral-700 disabled:opacity-50"
            title="Delete quotation"
          >
            <Trash2 className="h-3.5 w-3.5 sm:mr-1 inline" />
            <span>Delete</span>
          </button>
        )}
      </div>

      <ConfirmDeleteDialog
        isOpen={confirmOpen}
        isPending={isPending}
        title="Delete Quotation"
        description={
          <>
            Are you sure you want to delete quotation{' '}
            <strong className="text-ink-900">{quoteNumber}</strong>? This action
            will permanently remove it from the database and cannot be undone.
          </>
        }
        onConfirm={handleDelete}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
