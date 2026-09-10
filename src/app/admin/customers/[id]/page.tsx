import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { notFound } from 'next/navigation';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { CustomerForm } from '../customer-form';
import Link from 'next/link';
import { Phone, Mail, MessageCircle } from 'lucide-react';

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: customer }, { data: enquiries }, { data: bookings }] = await Promise.all([
    supabase.from('customers').select('*').eq('id', params.id).single(),
    supabase
      .from('enquiries')
      .select('id, enquiry_number, status, created_at, travel_packages(title)')
      .eq('customer_id', params.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('bookings')
      .select(
        'id, booking_number, booking_status, payment_status, total_amount, amount_received, travel_start_date, travel_packages(title)'
      )
      .eq('customer_id', params.id)
      .order('created_at', { ascending: false }),
  ]);

  if (!customer) notFound();

  const totalSpend = (bookings ?? []).reduce((sum, b) => sum + Number(b.amount_received), 0);
  const totalBookingValue = (bookings ?? []).reduce((sum, b) => sum + Number(b.total_amount), 0);

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">{customer.full_name}</h1>
          <p className="text-sm text-ink-500">Customer since {formatDate(customer.created_at)}</p>
        </div>
        <Link href="/admin/customers" className="btn-outline">
          Back to customers
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="card p-4">
              <p className="text-xs text-ink-400">Total spend</p>
              <p className="mt-1 text-lg font-semibold text-brand-700">{formatCurrency(totalSpend)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-ink-400">Booking value</p>
              <p className="mt-1 text-lg font-semibold text-ink-800">{formatCurrency(totalBookingValue)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-ink-400">Total bookings</p>
              <p className="mt-1 text-lg font-semibold text-ink-800">{bookings?.length ?? 0}</p>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-800">Enquiries</h2>
            <div className="space-y-2">
              {(enquiries ?? []).length === 0 && (
                <p className="text-sm text-ink-400">No enquiries from this customer yet.</p>
              )}
              {(enquiries ?? []).map((e) => (
                <Link
                  key={e.id}
                  href={`/admin/enquiries/${e.id}`}
                  className="flex items-center justify-between rounded-lg border border-ink-100 p-3 text-sm hover:bg-ink-50"
                >
                  <div>
                    <p className="font-medium text-ink-700">{e.enquiry_number}</p>
                    <p className="text-xs text-ink-400">
                      {(e.travel_packages as { title: string } | null)?.title ?? 'No package linked'} ·{' '}
                      {formatDate(e.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={e.status} />
                </Link>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-800">Bookings</h2>
            <div className="space-y-2">
              {(bookings ?? []).length === 0 && (
                <p className="text-sm text-ink-400">No bookings from this customer yet.</p>
              )}
              {(bookings ?? []).map((b) => (
                <Link
                  key={b.id}
                  href={`/admin/bookings/${b.id}`}
                  className="flex items-center justify-between rounded-lg border border-ink-100 p-3 text-sm hover:bg-ink-50"
                >
                  <div>
                    <p className="font-medium text-ink-700">{b.booking_number}</p>
                    <p className="text-xs text-ink-400">
                      {(b.travel_packages as { title: string } | null)?.title} · {formatDate(b.travel_start_date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-ink-700">{formatCurrency(b.total_amount)}</p>
                    <StatusBadge status={b.booking_status} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card space-y-2 p-5">
            <h2 className="text-sm font-semibold text-ink-800">Contact</h2>
            <a href={`tel:${customer.phone}`} className="flex items-center gap-2 text-sm text-ink-700 hover:text-brand-700">
              <Phone className="h-4 w-4" /> {customer.phone}
            </a>
            {customer.whatsapp_number && (
              <a
                href={`https://wa.me/${customer.whatsapp_number.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-ink-700 hover:text-brand-700"
              >
                <MessageCircle className="h-4 w-4" /> {customer.whatsapp_number}
              </a>
            )}
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="flex items-center gap-2 text-sm text-ink-700 hover:text-brand-700">
                <Mail className="h-4 w-4" /> {customer.email}
              </a>
            )}
            <div className="flex items-center gap-2 pt-1">
              <span
                className={`badge ${customer.whatsapp_opt_in ? 'bg-brand-100 text-brand-800' : 'bg-ink-100 text-ink-500'}`}
              >
                {customer.whatsapp_opt_in ? 'WhatsApp opted in' : 'Not opted in'}
              </span>
            </div>
          </div>

          <details className="card p-5">
            <summary className="cursor-pointer text-sm font-semibold text-ink-800">Edit customer</summary>
            <div className="mt-4">
              <CustomerForm
                customerId={customer.id}
                initialValues={{
                  full_name: customer.full_name,
                  phone: customer.phone,
                  whatsapp_number: customer.whatsapp_number,
                  email: customer.email,
                  address: customer.address,
                  city: customer.city,
                  state: customer.state,
                  country: customer.country ?? 'India',
                  source: customer.source,
                  tags: customer.tags,
                  notes: customer.notes,
                  whatsapp_opt_in: customer.whatsapp_opt_in,
                }}
              />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
