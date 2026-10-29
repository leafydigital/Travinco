'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { canAccess, isAdminRole, isFinanceRole } from '@/lib/tour/access';
import { getTourSettings } from '@/lib/tour/data';
import { addDays } from '@/lib/tour/engine';
import type { QuoteSnapshot } from '@/lib/tour/types';

export type InvoiceItem = { description: string; sac: string; qty: number; rate: number; amount: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

async function staff() {
  const profile = await requireProfile();
  if (!canAccess(profile, 'invoices')) return null;
  return { profile, supabase: await createClient() };
}

/** GST split for the invoice: CGST + SGST inside the company's state, IGST otherwise. */
function taxes(taxable: number, gstPct: number, mode: 'cgst_sgst' | 'igst') {
  const gst = r2((taxable * gstPct) / 100);
  if (mode === 'igst') return { gst, cgst: 0, sgst: 0, igst: gst };
  const half = r2(gst / 2);
  return { gst: r2(half * 2), cgst: half, sgst: half, igst: 0 };
}

/**
 * Creates the invoice for a quotation. The invoice total equals the quoted
 * package price: the taxable value is worked back from it (total ÷ (1 + GST%))
 * so the guest pays exactly what was quoted, with a paise-level round-off.
 */
export async function convertQuotationToInvoice(quotationId: string, option: 1 | 2 = 1): Promise<{ error?: string; id?: string }> {
  const s = await staff();
  if (!s) return { error: 'You do not have access to invoices.' };
  const { supabase, profile } = s;

  const { data: q } = await supabase.from('quotations').select('*').eq('id', quotationId).maybeSingle();
  if (!q) return { error: 'Quotation not found.' };
  const { data: existing } = await supabase.from('invoices').select('id').eq('quotation_id', quotationId).neq('status', 'cancelled').maybeSingle();
  if (existing) return { id: existing.id };
  if (q.status === 'rejected') return { error: 'This quotation was rejected. Change its status before invoicing.' };

  const total = Number(option === 2 && q.total_amount2 != null ? q.total_amount2 : q.total_amount);
  if (!(total > 0)) return { error: 'The quotation total is zero – price it before invoicing.' };
  const settings = await getTourSettings();
  const gstPct = Number(q.gst_pct ?? settings.gst_pct);
  const snap = q.snapshot as QuoteSnapshot;
  const opt = snap?.options?.[option - 1];

  // Link (or create) the CRM customer so the invoice shows under the customer.
  let customerId: string | null = q.customer_id;
  if (!customerId && q.guest_phone) {
    const { data: found } = await supabase.from('customers').select('id').eq('phone', q.guest_phone).limit(1).maybeSingle();
    if (found) customerId = found.id;
    else {
      const { data: created } = await supabase
        .from('customers')
        .insert({ full_name: q.guest_name, phone: q.guest_phone, email: q.guest_email, source: 'other', created_by: profile.id })
        .select('id')
        .single();
      customerId = created?.id ?? null;
    }
  }

  const mode: 'cgst_sgst' | 'igst' = 'cgst_sgst';
  const taxable = r2(total / (1 + gstPct / 100));
  const t = taxes(taxable, gstPct, mode);
  const roundOff = r2(total - taxable - t.gst);
  const route = snap?.route?.join(' – ') ?? '';
  const items: InvoiceItem[] = [
    {
      description:
        `${snap?.doc_title ?? 'Tour package'} – ${snap?.duration ?? `${q.nights + 1} Days / ${q.nights} Nights`}` +
        `${route ? ` (${route})` : ''}${opt?.category ? `, ${opt.category}` : ''}. ` +
        `Travel ${q.start_date} to ${q.end_date}; ${snap?.guests_line ?? `${q.adults} adults`}. Ref ${q.quote_number}.`,
      sac: settings.sac_code || '998555',
      qty: 1,
      rate: total,
      amount: total,
    },
  ];

  const today = new Date().toISOString().slice(0, 10);
  const markupPct = Number(q.markup_pct ?? 15);
  const markupAmount =
    option === 2 && q.markup_amount2 != null
      ? Number(q.markup_amount2)
      : q.markup_amount != null && Number(q.markup_amount) > 0
      ? Number(q.markup_amount)
      : r2((taxable * markupPct) / (100 + markupPct));

  const invoicePayload: Record<string, any> = {
    quotation_id: q.id,
    quote_option: option,
    customer_id: customerId,
    bill_to_name: q.guest_name,
    bill_to_phone: q.guest_phone,
    bill_to_email: q.guest_email,
    place_of_supply: settings.company_state || 'Kerala',
    invoice_date: today,
    due_date: settings.invoice_due_days ? addDays(today, settings.invoice_due_days) : q.start_date,
    travel_start: q.start_date,
    travel_end: q.end_date,
    items,
    subtotal: total,
    discount: 0,
    taxable_amount: total,
    gst_pct: gstPct,
    tax_mode: mode,
    cgst_amount: t.cgst,
    sgst_amount: t.sgst,
    igst_amount: t.igst,
    gst_amount: t.gst,
    round_off: roundOff,
    total_amount: total,
    status: 'issued',
    terms: settings.invoice_terms,
    created_by: profile.id,
    markup_pct: markupPct,
    markup_amount: markupAmount,
  };

  let { data: inv, error } = await supabase
    .from('invoices')
    .insert(invoicePayload)
    .select('id')
    .single();

  if (error && (error.message?.includes('markup') || error.code === '42703')) {
    delete invoicePayload.markup_pct;
    delete invoicePayload.markup_amount;
    const retry = await supabase
      .from('invoices')
      .insert(invoicePayload)
      .select('id')
      .single();
    inv = retry.data;
    error = retry.error;
  }

  if (error || !inv) {
    console.error('convertQuotationToInvoice', error?.message);
    return { error: 'Could not create the invoice.' };
  }

  // Persist markup metadata to website_settings fallback
  await supabase.from('website_settings').upsert({
    key: `invoice_markup_${inv.id}`,
    value: { markup_pct: markupPct, markup_amount: markupAmount },
  }, { onConflict: 'key' });

  await supabase.from('quotations').update({ status: 'invoiced', customer_id: customerId }).eq('id', q.id);
  if (q.enquiry_id) await supabase.from('enquiries').update({ status: 'confirmed' }).eq('id', q.enquiry_id);

  revalidatePath('/travinco_dashboard/invoices');
  revalidatePath('/travinco_dashboard/quotations');
  revalidatePath(`/admin/quotations/${q.id}`);
  return { id: inv.id };
}

// ---------------------------------------------------------------------------

const num = z.preprocess((v) => Number(String(v ?? '').replace(/[^\d.\-]/g, '') || 0), z.number().finite());
const optStr = (max: number) =>
  z.preprocess((v) => (v == null || String(v).trim() === '' ? null : String(v).trim()), z.string().max(max).nullable());

const invoiceSchema = z.object({
  bill_to_name: z.preprocess((v) => String(v ?? '').trim(), z.string().min(1, 'Bill-to name is required').max(150)),
  bill_to_phone: optStr(30),
  bill_to_email: optStr(150),
  bill_to_address: optStr(2000),
  bill_to_gstin: optStr(20),
  place_of_supply: optStr(60),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invoice date is required'),
  due_date: z.preprocess((v) => (v ? v : null), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  discount: num.pipe(z.number().min(0)),
  gst_pct: num.pipe(z.number().min(0).max(28)),
  tax_mode: z.enum(['cgst_sgst', 'igst']),
  notes: optStr(4000),
  terms: optStr(4000),
  markup_pct: num.optional(),
  markup_amount: num.optional(),
  items: z
    .array(
      z.object({
        description: z.preprocess((v) => String(v ?? '').trim(), z.string().min(1, 'Item description is required').max(1000)),
        sac: z.preprocess((v) => String(v ?? '').trim(), z.string().max(10)),
        qty: num.pipe(z.number().min(0)),
        rate: num,
      })
    )
    .min(1, 'Add at least one line item'),
});

/** Updates an invoice and recomputes its GST, totals, and markup on the server. */
export async function updateInvoice(id: string, raw: unknown): Promise<{ error?: string }> {
  const s = await staff();
  if (!s) return { error: 'You do not have access to invoices.' };
  const p = invoiceSchema.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0]?.message ?? 'Please check the invoice.' };
  const d = p.data;
  const { data: cur } = await s.supabase.from('invoices').select('status, amount_paid').eq('id', id).maybeSingle();
  if (!cur) return { error: 'Invoice not found.' };
  if (cur.status === 'cancelled') return { error: 'Cancelled invoices cannot be edited.' };

  const items: InvoiceItem[] = d.items.map((i) => ({ ...i, rate: r2(i.rate), amount: r2(i.qty * i.rate) }));
  const subtotal = r2(items.reduce((a, i) => a + i.amount, 0));
  const taxable = r2(Math.max(0, subtotal - d.discount));
  const t = taxes(taxable, d.gst_pct, d.tax_mode);
  const exact = taxable + t.gst;
  const total = Math.round(exact);
  const amountPaid = Number(cur.amount_paid);
  const status = amountPaid <= 0 ? 'issued' : amountPaid >= total ? 'paid' : 'partially_paid';

  const markupPct = d.markup_pct != null && !isNaN(d.markup_pct) ? Number(d.markup_pct) : 15;
  const markupAmount =
    d.markup_amount != null && Number(d.markup_amount) > 0
      ? r2(Number(d.markup_amount))
      : r2((taxable * markupPct) / (100 + markupPct));

  const updateData: Record<string, any> = {
    ...d,
    items,
    subtotal,
    taxable_amount: taxable,
    cgst_amount: t.cgst,
    sgst_amount: t.sgst,
    igst_amount: t.igst,
    gst_amount: t.gst,
    round_off: r2(total - exact),
    total_amount: total,
    status: cur.status === 'draft' ? 'draft' : status,
    markup_pct: markupPct,
    markup_amount: markupAmount,
  };

  let { error } = await s.supabase
    .from('invoices')
    .update(updateData)
    .eq('id', id);

  if (error && (error.message?.includes('markup') || error.code === '42703')) {
    delete updateData.markup_pct;
    delete updateData.markup_amount;
    const retry = await s.supabase
      .from('invoices')
      .update(updateData)
      .eq('id', id);
    error = retry.error;
  }

  if (error) {
    console.error('updateInvoice', error.message);
    return { error: 'Could not save the invoice.' };
  }

  // Persist markup metadata to website_settings fallback
  await s.supabase.from('website_settings').upsert({
    key: `invoice_markup_${id}`,
    value: { markup_pct: markupPct, markup_amount: markupAmount },
  }, { onConflict: 'key' });

  revalidatePath(`/admin/invoices/${id}`);
  revalidatePath(`/travinco_dashboard/invoices/${id}`);
  revalidatePath('/travinco_dashboard/invoices');
  revalidatePath('/travinco_dashboard');
  return {};
}

const paymentSchema = z.object({
  paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date is required'),
  amount: num.pipe(z.number().positive('Amount must be more than zero')),
  method: z.enum(['cash', 'bank_transfer', 'upi', 'credit_card', 'debit_card', 'cheque', 'other']),
  reference: optStr(100),
  notes: optStr(1000),
});

/** Records a payment; finance staff also get it booked in Income automatically. */
export async function addInvoicePayment(
  invoiceId: string,
  raw: unknown
): Promise<{ error?: string; info?: string; payment?: any }> {
  const s = await staff();
  if (!s) return { error: 'You do not have access to invoices.' };
  const p = paymentSchema.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0]?.message ?? 'Please check the payment.' };

  // 1. Fetch only essential invoice fields in one fast query
  const { data: inv } = await s.supabase
    .from('invoices')
    .select('id, invoice_number, status, balance_amount, total_amount, amount_paid, customer_id')
    .eq('id', invoiceId)
    .maybeSingle();

  if (!inv) return { error: 'Invoice not found.' };
  if (inv.status === 'cancelled') return { error: 'This invoice is cancelled.' };
  if (p.data.amount > Number(inv.balance_amount) + 0.5) {
    return { error: `Amount is more than the balance (₹${Number(inv.balance_amount).toLocaleString('en-IN')}).` };
  }

  // 2. Book into income if finance role
  let incomeId: string | null = null;
  let info: string | undefined;
  if (isFinanceRole(s.profile)) {
    const { data: income } = await s.supabase
      .from('income')
      .insert({
        income_date: p.data.paid_on,
        category: 'package_booking',
        description: `Payment for invoice ${inv.invoice_number}`,
        customer_id: inv.customer_id,
        amount: p.data.amount,
        payment_method: p.data.method,
        reference_number: p.data.reference,
        invoice_id: inv.id,
        created_by: s.profile.id,
      })
      .select('id')
      .single();
    incomeId = income?.id ?? null;
  } else {
    info = 'Payment recorded. Ask accounts to add it under Income.';
  }

  // 3. Insert payment record and return it directly
  const { data: paymentRow, error } = await s.supabase
    .from('invoice_payments')
    .insert({
      invoice_id: invoiceId,
      ...p.data,
      income_id: incomeId,
      created_by: s.profile.id,
    })
    .select('id, paid_on, amount, method, reference, notes, income_id')
    .single();

  if (error || !paymentRow) {
    if (incomeId) await s.supabase.from('income').delete().eq('id', incomeId);
    return { error: 'Could not record the payment.' };
  }

  // 4. Update invoice amount_paid and status directly (reusing known totals, avoiding redundant SELECTs)
  const newTotalPaid = Math.round(((Number(inv.amount_paid) || 0) + p.data.amount) * 100) / 100;
  const totalAmount = Number(inv.total_amount || 0);
  const newStatus =
    inv.status === 'cancelled' || inv.status === 'draft'
      ? inv.status
      : newTotalPaid >= totalAmount
      ? 'paid'
      : newTotalPaid > 0
      ? 'partially_paid'
      : 'issued';

  await s.supabase
    .from('invoices')
    .update({
      amount_paid: newTotalPaid,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId);

  revalidatePath(`/travinco_dashboard/invoices/${invoiceId}`);
  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath('/travinco_dashboard/invoices');
  revalidatePath('/travinco_dashboard/income');
  return { info, payment: paymentRow };
}

export async function deleteInvoicePayment(invoiceId: string, paymentId: string) {
  const profile = await requireProfile();
  if (!isAdminRole(profile)) return { error: 'Only admins can delete payments.' };
  const supabase = await createClient();

  // 1. Delete payment and retrieve income_id in a single database round-trip
  const { data: pay, error } = await supabase
    .from('invoice_payments')
    .delete()
    .eq('id', paymentId)
    .select('income_id')
    .maybeSingle();

  if (error) return { error: 'Could not delete the payment.' };

  // 2. Concurrently clean up associated income record and fetch remaining payments + invoice info
  const [paymentsRes, invRes] = await Promise.all([
    supabase.from('invoice_payments').select('amount').eq('invoice_id', invoiceId),
    supabase.from('invoices').select('total_amount, status').eq('id', invoiceId).maybeSingle(),
    pay?.income_id ? supabase.from('income').delete().eq('id', pay.income_id) : Promise.resolve(null),
  ]);
  const allPayments = paymentsRes?.data || [];
  const invRow = invRes?.data;

  if (invRow) {
    const totalPaid = allPayments.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
    const totalAmount = Number(invRow.total_amount || 0);
    const newStatus =
      invRow.status === 'cancelled' || invRow.status === 'draft'
        ? invRow.status
        : totalPaid >= totalAmount
        ? 'paid'
        : totalPaid > 0
        ? 'partially_paid'
        : 'issued';

    await supabase
      .from('invoices')
      .update({
        amount_paid: totalPaid,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);
  }

  revalidatePath(`/travinco_dashboard/invoices/${invoiceId}`);
  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath('/travinco_dashboard/invoices');
  revalidatePath('/travinco_dashboard/income');
  return {};
}

/** Cancels an invoice; the quotation goes back to "accepted" so it can be re-invoiced. */
export async function cancelInvoice(id: string) {
  const s = await staff();
  if (!s) return { error: 'You do not have access to invoices.' };
  if (!isAdminRole(s.profile) && !isFinanceRole(s.profile)) return { error: 'Only accounts or admins can cancel invoices.' };
  const { data: inv } = await s.supabase.from('invoices').select('quotation_id, amount_paid').eq('id', id).maybeSingle();
  if (!inv) return { error: 'Invoice not found.' };
  if (Number(inv.amount_paid) > 0) return { error: 'This invoice has payments. Remove or refund them first.' };
  const { error } = await s.supabase.from('invoices').update({ status: 'cancelled' }).eq('id', id);
  if (error) return { error: 'Could not cancel the invoice.' };
  if (inv.quotation_id) await s.supabase.from('quotations').update({ status: 'accepted' }).eq('id', inv.quotation_id);
  revalidatePath(`/travinco_dashboard/invoices/${id}`);
  revalidatePath(`/admin/invoices/${id}`);
  revalidatePath('/travinco_dashboard/invoices');
  return {};
}

/** Soft deletes an invoice and cleans up associated income and payment records. */
export async function deleteInvoice(id: string): Promise<{ error?: string }> {
  const profile = await requireProfile();
  if (!isAdminRole(profile)) return { error: 'Only admins can delete invoices.' };
  const supabase = await createClient();

  const { data: inv } = await supabase
    .from('invoices')
    .select('id, quotation_id')
    .eq('id', id)
    .maybeSingle();

  if (!inv) return { error: 'Invoice not found.' };

  // 1. Soft-delete associated income records created by invoice payments
  const { data: payments } = await supabase
    .from('invoice_payments')
    .select('income_id')
    .eq('invoice_id', id);
  const incomeIds = (payments || []).map((p) => p.income_id).filter(Boolean) as string[];
  if (incomeIds.length > 0) {
    await supabase.from('income').update({ is_deleted: true } as any).in('id', incomeIds);
  }

  // 2. Soft-delete any income record directly tagged with this invoice_id
  await supabase.from('income').update({ is_deleted: true } as any).eq('invoice_id', id);

  // 3. Try RPC soft_delete_invoice
  const { error: rpcError } = await supabase.rpc('soft_delete_invoice', {
    inv_id: id,
  });

  // 4. Direct update fallback if RPC is not yet created
  if (rpcError) {
    let { error } = await supabase.from('invoices').update({ is_deleted: true, status: 'cancelled' } as any).eq('id', id);
    if (error && error.message?.includes('is_deleted')) {
      console.warn('Column is_deleted missing from invoices table. Using website_settings marker.');
      await supabase.from('invoices').update({ status: 'cancelled' } as any).eq('id', id);
    } else if (error) {
      console.error('deleteInvoice error:', error.message);
      return { error: 'Could not delete the invoice: ' + error.message };
    }
  }

  // 5. Fallback tracking in website_settings so it is always filtered out
  try {
    await supabase.from('website_settings').upsert({
      key: `deleted_invoice_${id}`,
      value: { is_deleted: true, deleted_at: new Date().toISOString() },
    }, { onConflict: 'key' });
  } catch (err) {
    console.warn('Failed to record deleted_invoice marker:', err);
  }

  // 6. If quotation was marked as invoiced, revert quotation status to accepted
  if (inv.quotation_id) {
    await supabase.from('quotations').update({ status: 'accepted' }).eq('id', inv.quotation_id);
    revalidatePath(`/admin/quotations/${inv.quotation_id}`);
  }

  revalidatePath('/travinco_dashboard/invoices');
  revalidatePath(`/travinco_dashboard/invoices/${id}`);
  revalidatePath('/admin/invoices');
  revalidatePath(`/admin/invoices/${id}`);
  revalidatePath('/travinco_dashboard/quotations');
  revalidatePath('/travinco_dashboard/income');
  return {};
}

export interface InvoiceTableItem {
  id: string;
  invoice_number: string;
  quote_number: string | null;
  bill_to_name: string;
  bill_to_phone: string | null;
  invoice_date: string;
  due_date: string | null;
  total_amount: number;
  amount_paid: number;
  balance_amount: number;
  status: string;
}

export interface InvoicesTableQueryResult {
  invoices: InvoiceTableItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

/**
 * Fast, lean query fetching strictly the 8 visible columns for the invoices table:
 * Invoice (invoice_number), Quote # (quotations.quote_number), Bill to (bill_to_name, bill_to_phone),
 * Date (invoice_date, due_date), Total (total_amount), Paid (amount_paid), Balance (balance_amount), Status (status).
 * Excludes heavy 'items' (JSON), notes, terms, tax breakdowns, and bank details.
 */
export async function getInvoicesTableList({
  page = 1,
  pageSize = 20,
  q = '',
  status = '',
}: {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
} = {}): Promise<InvoicesTableQueryResult> {
  const profile = await requireProfile();
  if (!canAccess(profile, 'invoices')) {
    return { invoices: [], totalCount: 0, totalPages: 1, page: 1, pageSize };
  }

  const supabase = await createClient();
  const currentPage = Math.max(1, page);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('invoices')
    .select(
      'id, invoice_number, status, bill_to_name, bill_to_phone, invoice_date, due_date, total_amount, amount_paid, balance_amount, is_deleted, quotations(quote_number)',
      { count: 'exact' }
    )
    .order('invoice_date', { ascending: false })
    .order('created_at', { ascending: false });

  const term = q.replace(/[,()%*]/g, ' ').trim();
  if (term) {
    query = query.or(
      `invoice_number.ilike.%${term}%,bill_to_name.ilike.%${term}%,bill_to_phone.ilike.%${term}%`
    );
  }

  const validStatuses = ['issued', 'partially_paid', 'paid', 'cancelled'];
  if (status && validStatuses.includes(status)) {
    query = query.eq('status', status);
  }

  const [{ data: rows, count, error: queryError }, { data: deletedSettingsData }] = await Promise.all([
    query.range(from, to),
    supabase.from('website_settings').select('key').like('key', 'deleted_invoice_%'),
  ]);

  let invoiceRows: any[] | null = rows;
  if (queryError && queryError.message?.includes('is_deleted')) {
    let fallbackQuery = supabase
      .from('invoices')
      .select(
        'id, invoice_number, status, bill_to_name, bill_to_phone, invoice_date, due_date, total_amount, amount_paid, balance_amount, quotations(quote_number)',
        { count: 'exact' }
      )
      .order('invoice_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (term) {
      fallbackQuery = fallbackQuery.or(
        `invoice_number.ilike.%${term}%,bill_to_name.ilike.%${term}%,bill_to_phone.ilike.%${term}%`
      );
    }
    if (status && validStatuses.includes(status)) {
      fallbackQuery = fallbackQuery.eq('status', status);
    }
    const fallbackRes = await fallbackQuery.range(from, to);
    invoiceRows = fallbackRes.data;
  }

  const deletedKeys = new Set(
    (deletedSettingsData || []).map((s: { key: string }) => s.key.replace('deleted_invoice_', ''))
  );

  const activeRows = (invoiceRows ?? []).filter(
    (r: any) =>
      r &&
      r.is_deleted !== true &&
      r.is_deleted !== 'true' &&
      r.is_deleted !== 1 &&
      !deletedKeys.has(r.id)
  );

  const items: InvoiceTableItem[] = activeRows.map((r: any) => {
    const q = (Array.isArray(r.quotations) ? r.quotations[0] : r.quotations) as
      | { quote_number: string }
      | null
      | undefined;
    return {
      id: r.id,
      invoice_number: r.invoice_number,
      quote_number: q?.quote_number || null,
      bill_to_name: r.bill_to_name,
      bill_to_phone: r.bill_to_phone || null,
      invoice_date: r.invoice_date,
      due_date: r.due_date || null,
      total_amount: Number(r.total_amount) || 0,
      amount_paid: Number(r.amount_paid) || 0,
      balance_amount: Number(r.balance_amount) || 0,
      status: r.status,
    };
  });

  const totalCount = count ?? items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    invoices: items,
    totalCount,
    totalPages,
    page: currentPage,
    pageSize,
  };
}
