import 'server-only';
import { createCustomerClient } from '@/lib/supabase/server';
import type { InvoiceDoc } from '@/components/tour/invoice-document';

export type CustomerInvoice = {
  id: string;
  invoice_number: string;
  quotation_id: string | null;
  bill_to_name: string;
  bill_to_email: string | null;
  invoice_date: string;
  due_date: string | null;
  travel_start: string | null;
  travel_end: string | null;
  items: { description: string; sac?: string; qty: number; rate: number; amount: number }[];
  total_amount: number;
  amount_paid: number;
  balance_amount: number;
  status: string;
  created_at: string;
  trip_title?: string | null;
};

export type CustomerTripBooking = {
  id: string;
  booking_number: string;
  booking_status: string;
  payment_status: string;
  total_amount: number;
  travel_start_date: string;
  travel_end_date: string;
  created_at: string;
  package_title?: string;
  package_slug?: string;
  package_cover_image?: string | null;
};

export type CustomerTripEnquiry = {
  id: string;
  enquiry_number: string;
  status: string;
  destination: string | null;
  created_at: string;
  package_title?: string;
};

export type CustomerDashboardData = {
  invoices: CustomerInvoice[];
  bookings: CustomerTripBooking[];
  enquiries: CustomerTripEnquiry[];
};

/**
 * Retrieves all data for the customer's "My Bookings & Invoices" page.
 * Strictly focuses on Invoices: when admin converts quotation to invoice,
 * the invoice is displayed here for the customer.
 */
export async function getCustomerDashboardData(accountEmail: string): Promise<CustomerDashboardData> {
  const supabase = await createCustomerClient();
  const normalizedEmail = accountEmail.trim().toLowerCase();

  // 1. Find matching customer record (if any)
  const { data: customerRow } = await supabase
    .from('customers')
    .select('id, full_name, phone, email')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  const customerId = customerRow?.id ?? null;

  // 2. Fetch invoices for this customer
  let invoiceQuery = supabase
    .from('invoices')
    .select(
      'id, invoice_number, quotation_id, bill_to_name, bill_to_email, invoice_date, due_date, travel_start, travel_end, items, total_amount, amount_paid, balance_amount, status, created_at, is_deleted, quotations(title, trip_type)'
    )
    .neq('status', 'cancelled')
    .neq('is_deleted', true)
    .order('created_at', { ascending: false });

  if (customerId) {
    invoiceQuery = invoiceQuery.or(
      `customer_id.eq.${customerId},bill_to_email.ilike.${normalizedEmail}`
    );
  } else {
    invoiceQuery = invoiceQuery.ilike('bill_to_email', normalizedEmail);
  }

  const { data: rawInvoices, error: invErr } = await invoiceQuery;
  if (invErr) {
    console.error('Customer invoices query error:', invErr.message);
  }

  const invoicesList: CustomerInvoice[] = (rawInvoices ?? []).map((inv: any) => {
    const q = Array.isArray(inv.quotations) ? inv.quotations[0] : inv.quotations;
    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      quotation_id: inv.quotation_id,
      bill_to_name: inv.bill_to_name,
      bill_to_email: inv.bill_to_email,
      invoice_date: inv.invoice_date,
      due_date: inv.due_date,
      travel_start: inv.travel_start,
      travel_end: inv.travel_end,
      items: Array.isArray(inv.items) ? inv.items : [],
      total_amount: Number(inv.total_amount),
      amount_paid: Number(inv.amount_paid),
      balance_amount: Number(inv.balance_amount),
      status: inv.status,
      created_at: inv.created_at,
      trip_title: q?.title || null,
    };
  });

  // 3. Fetch legacy / direct bookings (if any)
  let bookingsList: CustomerTripBooking[] = [];
  if (customerId) {
    const { data: rawBookings } = await supabase
      .from('bookings')
      .select(
        'id, booking_number, booking_status, payment_status, total_amount, travel_start_date, travel_end_date, created_at, travel_packages(title, slug, cover_image_url)'
      )
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (rawBookings) {
      bookingsList = rawBookings.map((b: any) => {
        const pkg = Array.isArray(b.travel_packages) ? b.travel_packages[0] : b.travel_packages;
        return {
          id: b.id,
          booking_number: b.booking_number,
          booking_status: b.booking_status,
          payment_status: b.payment_status,
          total_amount: Number(b.total_amount),
          travel_start_date: b.travel_start_date,
          travel_end_date: b.travel_end_date,
          created_at: b.created_at,
          package_title: pkg?.title,
          package_slug: pkg?.slug,
          package_cover_image: pkg?.cover_image_url,
        };
      });
    }
  }

  // 4. Fetch enquiries (pending quote requests)
  const { data: rawEnquiries } = await supabase
    .from('enquiries')
    .select('id, enquiry_number, status, destination, created_at, travel_packages(title)')
    .ilike('email', normalizedEmail)
    .order('created_at', { ascending: false });

  // Exclude enquiries that already became confirmed bookings
  const bookedEnquiryIds = new Set(
    (bookingsList as any[]).map((b) => b.enquiry_id).filter(Boolean)
  );

  const enquiriesList: CustomerTripEnquiry[] = (rawEnquiries ?? [])
    .filter((e: any) => !bookedEnquiryIds.has(e.id))
    .map((e: any) => {
      const pkg = Array.isArray(e.travel_packages) ? e.travel_packages[0] : e.travel_packages;
      return {
        id: e.id,
        enquiry_number: e.enquiry_number,
        status: e.status,
        destination: e.destination,
        created_at: e.created_at,
        package_title: pkg?.title,
      };
    });

  return {
    invoices: invoicesList,
    bookings: bookingsList,
    enquiries: enquiriesList,
  };
}

/**
 * Retrieves a single invoice for customer document view.
 * Strictly verifies customer ownership.
 */
export async function getCustomerInvoiceById(id: string, accountEmail: string) {
  const supabase = await createCustomerClient();
  const normalizedEmail = accountEmail.trim().toLowerCase();

  const { data: customerRow } = await supabase
    .from('customers')
    .select('id')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  const { data: inv } = await supabase
    .from('invoices')
    .select('*, quotations(id, quote_number, markup_pct, markup_amount, total_amount)')
    .eq('id', id)
    .neq('status', 'cancelled')
    .neq('is_deleted', true)
    .maybeSingle();

  if (!inv) return null;

  // Authorization check
  const matchesEmail = inv.bill_to_email?.trim().toLowerCase() === normalizedEmail;
  const matchesCustomer = customerRow?.id && inv.customer_id === customerRow.id;

  if (!matchesEmail && !matchesCustomer) {
    return null;
  }

  const q = (Array.isArray(inv.quotations) ? inv.quotations[0] : inv.quotations) as {
    id: string;
    quote_number: string;
    markup_pct?: number;
    markup_amount?: number;
  } | null;

  const doc: InvoiceDoc = {
    ...inv,
    items: Array.isArray(inv.items) ? inv.items : [],
    quote_number: q?.quote_number ?? null,
    markup_pct: inv.markup_pct ?? q?.markup_pct ?? 15,
    markup_amount: inv.markup_amount ?? q?.markup_amount ?? 0,
  };

  return {
    invoice: doc,
    rawInvoice: inv,
    quotation: q,
  };
}

/**
 * Retrieves a single quotation for customer document view if accessed directly.
 * Strictly verifies customer ownership and 'invoiced' status.
 */
export async function getCustomerQuotationById(id: string, accountEmail: string) {
  const supabase = await createCustomerClient();
  const normalizedEmail = accountEmail.trim().toLowerCase();

  const { data: customerRow } = await supabase
    .from('customers')
    .select('id')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  const { data: q } = await supabase
    .from('quotations')
    .select('*')
    .eq('id', id)
    .eq('status', 'invoiced')
    .neq('is_deleted', true)
    .maybeSingle();

  if (!q) return null;

  // Authorization check
  const matchesEmail = q.guest_email?.trim().toLowerCase() === normalizedEmail;
  const matchesCustomer = customerRow?.id && q.customer_id === customerRow.id;

  if (!matchesEmail && !matchesCustomer) {
    return null;
  }

  // Also fetch linked invoice if any
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, invoice_number, status')
    .eq('quotation_id', q.id)
    .neq('status', 'cancelled')
    .maybeSingle();

  return {
    quotation: q,
    linkedInvoice: invoice || null,
  };
}

