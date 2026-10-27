'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { deleteHotel } from './actions';
import { ConfirmDeleteDialog } from '@/components/admin/confirm-delete-dialog';

interface HotelRowActionsProps {
  id: number;
  name: string;
  canEdit: boolean;
}

export function HotelRowActions({ id, name, canEdit }: HotelRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteHotel(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Hotel deleted successfully');
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        <Link
          href={`/travinco_dashboard/hotels/${id}`}
          prefetch={true}
          className="btn-outline h-8 px-2.5 text-xs text-brand-700 hover:bg-brand-50"
        >
          {canEdit ? 'Edit' : 'View'}
        </Link>
        {canEdit && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={isPending}
            className="btn-ghost h-8 px-2 text-xs text-coral-600 hover:bg-coral-50 hover:text-coral-700 disabled:opacity-50"
            title="Delete hotel"
          >
            <Trash2 className="h-3.5 w-3.5 sm:mr-1 inline" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        )}
      </div>

      <ConfirmDeleteDialog
        isOpen={confirmOpen}
        isPending={isPending}
        title="Delete Hotel"
        description={
          <>
            Are you sure you want to delete hotel{' '}
            <strong className="text-ink-900">{name}</strong>? This action cannot be
            undone.
          </>
        }
        onConfirm={handleDelete}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
