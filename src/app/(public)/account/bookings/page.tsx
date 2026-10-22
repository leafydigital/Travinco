import { createClient } from '@/lib/supabase/server';
import { requireCustomer } from '@/lib/supabase/customer-auth-helpers';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import Link from 'next/link';
import { Calendar, Package, ArrowLeft, Clock, CheckCircle2, XCircle, Loader, Plus, Compass } from 'lucide-react';

/** Maps the raw database status to a plain-language label and a visual
 * treatment a customer can understand at a glance, without needing to
 * know the internal workflow terms staff use. */
function getStatusDisplay(status: string) {
  switch (status) {
    case 'confirmed':
    case 'partially_paid':
    case 'fully_paid':
    case 'completed':
      return { label: 'Confirmed', color: 'text-brand-700 bg-brand-50', Icon: CheckCircle2 };
    case 'cancelled':
      return { label: 'Rejected', color: 'text-coral-700 bg-coral-50', Icon: XCircle };
    case 'inquiry':
    case 'pending':
    default:
      return { label: 'Processing', color: 'text-sand-700 bg-sand-50', Icon: Loader };
  }
}

function getEnquiryStatusDisplay(status: string) {
  switch (status) {
    case 'confirmed':
      return { label: 'Accepted', color: 'text-brand-700 bg-brand-50', Icon: CheckCircle2 };
    case 'lost':
      return { label: 'Rejected', color: 'text-coral-700 bg-coral-50', Icon: XCircle };
    case 'closed':
      return { label: 'Closed', color: 'text-ink-500 bg-ink-100', Icon: XCircle };
    default:
      return { label: 'Processing', color: 'text-sand-700 bg-sand-50', Icon: Loader };
  }
}

export default async function BookingsPage() {
  const account = await requireCustomer();
  // Standard Supabase SSR client governed by RLS (migration 027 allows
  // customers to view only their own bookings/enquiries matching their account).
  const supabase = await createClient();

  // Run customer lookup and enquiries queries concurrently
  const [customerRowRes, { data: enquiries }] = await Promise.all([
    supabase
      .from('customers')
      .select('id')
      .eq('email', account.email)
      .maybeSingle(),
    supabase
      .from('enquiries')
      .select('*, travel_packages(title)')
      .eq('email', account.email)
      .order('created_at', { ascending: false }),
  ]);

  const customerRow = customerRowRes.data;
  const { data: bookings } = customerRow
    ? await supabase
        .from('bookings')
        .select('*, travel_packages(title, slug, cover_image_url)')
        .eq('customer_id', customerRow.id)
        .order('created_at', { ascending: false })
    : { data: [] };

  const bookingRows = bookings ?? [];
  // Only show enquiries that haven't already become one of the bookings
  // above, so the same trip request doesn't appear twice once staff
  // convert it.
  const convertedEnquiryIds = new Set(bookingRows.map((b) => b.enquiry_id).filter(Boolean));
  const enquiryRows = (enquiries ?? []).filter((e) => !convertedEnquiryIds.has(e.id));

  const hasNothing = bookingRows.length === 0 && enquiryRows.length === 0;

  return (
    <div className="container-page max-w-3xl pt-32 pb-16">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/account" className="mb-2 flex items-center gap-1.5 text-sm text-ink-500 hover:text-brand-700">
            <ArrowLeft className="h-4 w-4" /> Back to account
          </Link>
          <h1 className="font-display text-2xl font-semibold text-ink-900">My Bookings &amp; Quotes</h1>
        </div>
        <Link href="/booking" className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus className="h-4 w-4" /> Request a Quote
        </Link>
      </div>

      {hasNothing ? (
        <div className="mt-6 rounded-xl2 border border-dashed border-ink-200 py-12 text-center">
          <Package className="mx-auto h-8 w-8 text-ink-300" />
          <p className="mt-3 font-semibold text-ink-800">No bookings or quotes yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">
            You don&apos;t have any active bookings or quote requests yet under this email. Start planning your custom trip today!
          </p>
          <div className="mt-5">
            <Link href="/booking" className="btn-primary inline-flex items-center gap-2 text-sm">
              <Compass className="h-4 w-4" /> Request a Quote
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {bookingRows.map((booking) => {
            const pkg = booking.travel_packages as
              | { title: string; slug: string; cover_image_url: string | null }
              | { title: string; slug: string; cover_image_url: string | null }[]
              | null;
            const pkgData = Array.isArray(pkg) ? pkg[0] : pkg;
            const status = getStatusDisplay(booking.booking_status);

            return (
              <div key={booking.id} className="card flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="text-xs font-medium text-brand-600">{booking.booking_number}</p>
                  <p className="mt-0.5 font-medium text-ink-900">{pkgData?.title ?? 'Package'}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-500">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(booking.travel_start_date)} – {formatDate(booking.travel_end_date)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-ink-900">
                    {formatCurrency(booking.total_amount, 'INR')}
                  </p>
                  <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${status.color}`}>
                    <status.Icon className="h-3 w-3" /> {status.label}
                  </span>
                </div>
              </div>
            );
          })}

          {enquiryRows.map((enquiry) => {
            const pkg = enquiry.travel_packages as { title: string } | { title: string }[] | null;
            const pkgData = Array.isArray(pkg) ? pkg[0] : pkg;
            const status = getEnquiryStatusDisplay(enquiry.status);

            return (
              <div key={enquiry.id} className="card flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="text-xs font-medium text-brand-600">{enquiry.enquiry_number}</p>
                  <p className="mt-0.5 font-medium text-ink-900">
                    {pkgData?.title ?? enquiry.destination ?? 'Trip enquiry'}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-500">
                    <Clock className="h-3.5 w-3.5" /> Submitted {formatDate(enquiry.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${status.color}`}>
                    <status.Icon className="h-3 w-3" /> {status.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
