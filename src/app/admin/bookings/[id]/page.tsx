import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { notFound } from 'next/navigation';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { BookingStatusControl } from './booking-status-control';
import { PaymentsPanel } from './payments-panel';
import { PassengersPanel } from './passengers-panel';
import { BookingRowActions } from '../booking-row-actions';
import Link from 'next/link';

export default async function BookingDetailPage({ params }: { params: { id: string } }) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: booking }, { data: payments }, { data: passengers }] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, customers(full_name, phone, email), travel_packages(title, slug)')
      .eq('id', params.id)
      .single(),
    supabase
      .from('payments')
      .select('*')
      .eq('booking_id', params.id)
      .order('payment_date', { ascending: false }),
    supabase.from('booking_passengers').select('*').eq('booking_id', params.id),
  ]);

  if (!booking) notFound();

  const customerRaw = booking.customers as
    | { full_name: string; phone: string; email: string | null }
    | { full_name: string; phone: string; email: string | null }[]
    | null;
  const customer = Array.isArray(customerRaw) ? customerRaw[0] ?? null : customerRaw;
  const pkgRaw = booking.travel_packages as
    | { title: string; slug: string }
    | { title: string; slug: string }[]
    | null;
  const pkg = Array.isArray(pkgRaw) ? pkgRaw[0] ?? null : pkgRaw;
  const canDeletePayment = ['accounts_staff', 'admin', 'super_admin'].includes(profile.role);

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-ink-900">{booking.booking_number}</h1>
            <StatusBadge status={booking.booking_status} />
            <StatusBadge status={booking.payment_status} />
          </div>
          <p className="text-sm text-ink-500">
            {customer?.full_name} · {pkg?.title}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BookingStatusControl bookingId={booking.id} currentStatus={booking.booking_status} />
          <BookingRowActions id={booking.id} redirectOnDelete />
          <Link href="/admin/bookings" className="btn-outline">
            Back
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card space-y-4 p-5">
            <h2 className="text-sm font-semibold text-ink-800">Trip details</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-ink-400">Package</dt>
                <dd className="text-ink-700">{pkg?.title ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-ink-400">Travel dates</dt>
                <dd className="text-ink-700">
                  {formatDate(booking.travel_start_date)} – {formatDate(booking.travel_end_date)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-400">Travelers</dt>
                <dd className="text-ink-700">
                  {booking.number_of_adults} adults, {booking.number_of_children} children,{' '}
                  {booking.number_of_infants} infants
                </dd>
              </div>
            </dl>
            {booking.notes && (
              <div className="border-t border-ink-100 pt-3">
                <dt className="text-sm text-ink-400">Notes</dt>
                <dd className="text-sm text-ink-700">{booking.notes}</dd>
              </div>
            )}
          </div>

          <PassengersPanel bookingId={booking.id} passengers={passengers ?? []} />
          <PaymentsPanel bookingId={booking.id} payments={payments ?? []} canDelete={canDeletePayment} />
        </div>

        <div className="space-y-6">
          <div className="card space-y-3 p-5">
            <h2 className="text-sm font-semibold text-ink-800">Customer</h2>
            <p className="text-sm text-ink-700">{customer?.full_name}</p>
            <p className="text-sm text-ink-500">{customer?.phone}</p>
            {customer?.email && <p className="text-sm text-ink-500">{customer.email}</p>}
          </div>

          <div className="card space-y-2.5 p-5">
            <h2 className="text-sm font-semibold text-ink-800">Payment summary</h2>
            <div className="flex justify-between text-sm">
              <span className="text-ink-500">Base amount</span>
              <span className="text-ink-700">{formatCurrency(booking.base_amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-500">Discount</span>
              <span className="text-ink-700">− {formatCurrency(booking.discount_amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-500">Tax</span>
              <span className="text-ink-700">+ {formatCurrency(booking.tax_amount)}</span>
            </div>
            <div className="flex justify-between border-t border-ink-100 pt-2.5 text-sm font-semibold">
              <span className="text-ink-800">Total</span>
              <span className="text-ink-900">{formatCurrency(booking.total_amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-500">Received</span>
              <span className="text-brand-700">{formatCurrency(booking.amount_received)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-ink-800">Balance due</span>
              <span className={booking.balance_amount > 0 ? 'text-red-600' : 'text-brand-700'}>
                {formatCurrency(booking.balance_amount)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
