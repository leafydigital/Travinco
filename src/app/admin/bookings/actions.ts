'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { bookingSchema, passengerSchema, paymentSchema } from '@/lib/validations/booking';
import { revalidatePath } from 'next/cache';
import type { BookingStatus } from '@/types/database';

async function logAudit(action: string, entityId: string, before?: unknown, after?: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from('audit_logs').insert({
    actor_id: user?.id ?? null,
    action,
    entity_type: 'bookings',
    entity_id: entityId,
    before_data: (before as never) ?? null,
    after_data: (after as never) ?? null,
  });
}

export async function updateBooking(id: string, raw: unknown) {
  await requireProfile();
  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the booking fields.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('bookings').update(parsed.data).eq('id', id);
  if (error) return { error: 'Could not update booking.' };

  await logAudit('booking.updated', id, null, parsed.data);
  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath('/admin/bookings');
  return {};
}

const bookingStatuses: BookingStatus[] = [
  'inquiry', 'pending', 'confirmed', 'partially_paid', 'fully_paid', 'cancelled', 'completed',
];

export async function updateBookingStatus(id: string, status: BookingStatus) {
  await requireProfile();
  if (!bookingStatuses.includes(status)) return { error: 'Invalid status.' };

  const supabase = await createClient();
  const { data: before } = await supabase.from('bookings').select('booking_status').eq('id', id).single();

  const { error } = await supabase.from('bookings').update({ booking_status: status }).eq('id', id);
  if (error) return { error: 'Could not update booking status.' };

  await logAudit('booking.status_changed', id, before, { status });
  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath('/admin/bookings');
  return {};
}

export async function addPassenger(bookingId: string, raw: unknown) {
  await requireProfile();
  const parsed = passengerSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid passenger details.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('booking_passengers')
    .insert({ ...parsed.data, booking_id: bookingId });
  if (error) return { error: 'Could not add passenger.' };

  revalidatePath(`/admin/bookings/${bookingId}`);
  return {};
}

export async function removePassenger(bookingId: string, passengerId: string) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from('booking_passengers').delete().eq('id', passengerId);
  if (error) return { error: 'Could not remove passenger.' };
  revalidatePath(`/admin/bookings/${bookingId}`);
  return {};
}

/**
 * Records a payment against a booking. bookings.amount_received,
 * balance_amount and payment_status are all recalculated automatically by
 * DB triggers (see migration 004) — this action does not touch them
 * directly, so there's no way for the app layer to drift out of sync with
 * the payments table.
 *
 * Also writes a matching income row, since a payment received against a
 * booking is income by definition — keeping the finance module and the
 * booking's payment history from diverging into two sources of truth.
 */
export async function recordPayment(bookingId: string, raw: unknown) {
  const profile = await requireProfile();
  const parsed = paymentSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid payment.' };

  const supabase = await createClient();

  const { data: booking } = await supabase
    .from('bookings')
    .select('customer_id, package_id')
    .eq('id', bookingId)
    .single();
  if (!booking) return { error: 'Booking not found.' };

  const { error: paymentError } = await supabase.from('payments').insert({
    booking_id: bookingId,
    ...parsed.data,
    recorded_by: profile.id,
  });
  if (paymentError) return { error: 'Could not record payment.' };

  const { error: incomeError } = await supabase.from('income').insert({
    income_date: parsed.data.payment_date,
    category: 'package_booking',
    description: `Payment for booking`,
    customer_id: booking.customer_id,
    booking_id: bookingId,
    amount: parsed.data.amount,
    payment_method: parsed.data.payment_method,
    reference_number: parsed.data.reference_number,
    created_by: profile.id,
  });
  // A failed income insert shouldn't roll back a successfully recorded
  // payment — the payment is the primary record; surface a warning
  // instead of blocking, so finance can reconcile it manually if needed.
  if (incomeError) {
    return {
      warning:
        'Payment recorded, but could not create the matching income entry. Add it manually in Income.',
    };
  }

  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/admin/income');
  revalidatePath('/admin/reports');
  return {};
}

export async function deletePayment(bookingId: string, paymentId: string) {
  const profile = await requireProfile();
  if (!['accounts_staff', 'admin', 'super_admin'].includes(profile.role)) {
    return { error: 'Only finance staff can delete a payment.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('payments').delete().eq('id', paymentId);
  if (error) return { error: 'Could not delete payment.' };

  revalidatePath(`/admin/bookings/${bookingId}`);
  return {};
}
