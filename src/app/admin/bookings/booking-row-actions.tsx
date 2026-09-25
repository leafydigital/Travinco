'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { deleteBooking } from './actions';

export function BookingRowActions({
  id,
  redirectOnDelete,
}: {
  id: string;
  /** When deleting from the booking's own detail page, navigate back
   * to the list afterward instead of refreshing in place — the record
   * being viewed no longer exists to show. */
  redirectOnDelete?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remove() {
    if (!confirm('Delete this booking? This cannot be undone.')) return;
    startTransition(async () => {
      const result = await deleteBooking(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Booking deleted');
      if (redirectOnDelete) {
        router.push('/admin/bookings');
      } else {
        router.refresh();
      }
    });
  }

  if (redirectOnDelete) {
    return (
      <button
        type="button"
        onClick={remove}
        disabled={isPending}
        className="btn-outline border-coral-300 text-coral-600 hover:bg-coral-50"
      >
        <Trash2 className="h-4 w-4" /> {isPending ? 'Deleting…' : 'Delete'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={isPending}
      className="rounded-lg p-1.5 text-coral-600 hover:bg-coral-50 disabled:opacity-50"
      aria-label="Delete booking"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
