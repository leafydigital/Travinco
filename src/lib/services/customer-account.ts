import 'server-only';
import { createCustomerClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { escapeLike } from '@/lib/auth/signup-rules';
import { splitEnquiryMessage } from '@/lib/enquiry-display';
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

export type CustomerTripEnquiry = {
  id: string;
  enquiry_number: string;
  status: string;
  destination: string | null;
  travel_date: string | null;
  number_of_adults: number;
  number_of_children: number;
  number_of_infants: number;
  created_at: string;
  package_title?: string;
};

export type CustomerDashboardData = {
  invoices: CustomerInvoice[];
  enquiries: CustomerTripEnquiry[];
};

/**
 * Retrieves all data for the customer's "My Bookings" page:
 * - invoices (shown once the team converts a quotation into an invoice)
 * - enquiries submitted through the "Book with us" / package enquiry forms
 *   (Contact-page messages are excluded).
 * Callers must pass the email of the verified, signed-in customer.
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

  // 3. Booking-form enquiries for this email. Read with the service role (RLS does
  //    not grant customers access to enquiries); scoped strictly to the session email.
  let enquiriesList: CustomerTripEnquiry[] = [];
  try {
    const service = createServiceClient();
    const { data: rawEnquiries, error: enqErr } = await service
      .from('enquiries')
      .select(
        'id, enquiry_number, status, destination, travel_date, number_of_adults, number_of_children, number_of_infants, message, source, is_deleted, created_at, travel_packages(title)'
      )
      .ilike('email', escapeLike(normalizedEmail))
      .eq('source', 'website')
      .order('created_at', { ascending: false })
      .limit(100);
    if (enqErr) console.error('Customer enquiries query error:', enqErr.message);

    enquiriesList = (rawEnquiries ?? [])
      .filter((e: any) => e.is_deleted !== true && !splitEnquiryMessage(e.message).isContactForm)
      .map((e: any) => {
        const pkg = Array.isArray(e.travel_packages) ? e.travel_packages[0] : e.travel_packages;
        return {
          id: e.id,
          enquiry_number: e.enquiry_number,
          status: e.status,
          destination: e.destination,
          travel_date: e.travel_date,
          number_of_adults: Number(e.number_of_adults) || 0,
          number_of_children: Number(e.number_of_children) || 0,
          number_of_infants: Number(e.number_of_infants) || 0,
          created_at: e.created_at,
          package_title: pkg?.title,
        };
      });
  } catch (err) {
    console.error('Customer enquiries load failed:', err);
  }

  return {
    invoices: invoicesList,
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

