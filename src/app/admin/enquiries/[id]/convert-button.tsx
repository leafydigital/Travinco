'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { convertEnquiryToBooking } from '../actions';
import { ArrowRightCircle } from 'lucide-react';

export function ConvertToBookingButton({ enquiryId, hasPackage }: { enquiryId: string; hasPackage: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleConvert() {
    if (!confirm('Convert this enquiry into a booking?')) return;
    startTransition(async () => {
      const result = await convertEnquiryToBooking(enquiryId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Booking created');
      if (result.bookingId) router.push(`/admin/bookings/${result.bookingId}`);
    });
  }

  return (
    <button
      onClick={handleConvert}
      disabled={isPending || !hasPackage}
      title={!hasPackage ? 'Link a package to this enquiry first' : undefined}
      className="btn-primary"
    >
      <ArrowRightCircle className="h-4 w-4" />
      {isPending ? 'Converting…' : 'Convert to booking'}
    </button>
  );
}
