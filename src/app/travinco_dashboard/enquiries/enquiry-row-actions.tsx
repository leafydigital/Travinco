'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Pencil, Trash2, Eye } from 'lucide-react';
import { deleteEnquiry } from './actions';
import { ConfirmDeleteDialog } from '@/components/admin/confirm-delete-dialog';

export function EnquiryRowActions({
  id,
  customerName,
  isAdmin = false,
  canEdit = true,
}: {
  id: string;
  customerName?: string;
  isAdmin?: boolean;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  function handleConfirmDelete() {
    startTransition(async () => {
      const result = await deleteEnquiry(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Enquiry moved to trash');
      setIsDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        {/* View Action */}
        <Link
          href={`/travinco_dashboard/enquiries/${id}`}
          className="rounded-lg p-1.5 text-brand-600 hover:bg-brand-50 hover:text-brand-800 transition-colors"
          aria-label="View enquiry"
          title="View enquiry details"
        >
          <Eye className="h-3.5 w-3.5" />
        </Link>

        {/* Edit Action */}
        {canEdit && (
          <Link
            href={`/travinco_dashboard/enquiries/${id}?edit=true`}
            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800 transition-colors"
            aria-label="Edit enquiry"
            title="Edit enquiry details"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Link>
        )}

        {/* Delete Action (Admin Only) */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setIsDeleteOpen(true)}
            disabled={isPending}
            className="rounded-lg p-1.5 text-coral-600 hover:bg-coral-50 disabled:opacity-50 transition-colors cursor-pointer"
            aria-label="Delete enquiry"
            title="Delete enquiry (admin only)"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <ConfirmDeleteDialog
        isOpen={isDeleteOpen}
        title="Delete Enquiry"
        description={
          <div className="space-y-3 text-left">
            <p className="text-sm text-ink-700 leading-normal">
              Are you sure you want to delete this enquiry?
            </p>
            {customerName && (
              <div className="rounded-xl border border-ink-200/90 bg-ink-50/80 p-3 flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-coral-100 text-coral-700">
                  <Trash2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Target Lead / Customer</p>
                  <p className="text-sm font-bold text-ink-900 truncate">
                    {customerName}
                  </p>
                </div>
              </div>
            )}
            <p className="text-xs text-ink-500 leading-relaxed">
              This record will be removed from active enquiries.
            </p>
          </div>
        }
        confirmLabel="Delete Enquiry"
        isPending={isPending}
        onConfirm={handleConfirmDelete}
        onClose={() => setIsDeleteOpen(false)}
      />
    </>
  );
}
