'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { updateBookingStatus } from '../actions';
import type { BookingStatus } from '@/types/database';

const statuses: BookingStatus[] = [
  'inquiry', 'pending', 'confirmed', 'partially_paid', 'fully_paid', 'cancelled', 'completed',
];

export function BookingStatusControl({
  bookingId,
  currentStatus,
}: {
  bookingId: string;
  currentStatus: BookingStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={currentStatus}
      disabled={isPending}
      onChange={(e) => {
        startTransition(async () => {
          const result = await updateBookingStatus(bookingId, e.target.value as BookingStatus);
          if (result.error) toast.error(result.error);
          else router.refresh();
        });
      }}
      className="input w-auto"
    >
      {statuses.map((s) => (
        <option key={s} value={s}>
          {s.replace('_', ' ')}
        </option>
      ))}
    </select>
  );
}
