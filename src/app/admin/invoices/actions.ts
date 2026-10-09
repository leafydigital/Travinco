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
      rate: taxable,
      amount: taxable,
    },
  ];

  const today = new Date().toISOString().slice(0, 10);
  const { data: inv, error } = await supabase
    .from('invoices')
    .insert({
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
      subtotal: taxable,
      discount: 0,
      taxable_amount: taxable,
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
    })
    .select('id')
    .single();
  if (error || !inv) {
    console.error('convertQuotationToInvoice', error?.message);
    return { error: 'Could not create the invoice.' };
  }

  await supabase.from('quotations').update({ status: 'invoiced', customer_id: customerId }).eq('id', q.id);
  if (q.enquiry_id) await supabase.from('enquiries').update({ status: 'confirmed' }).eq('id', q.enquiry_id);

  revalidatePath('/admin/invoices');
  revalidatePath('/admin/quotations');
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

/** Updates an invoice and recomputes its GST and totals on the server. */
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

  const { error } = await s.supabase
    .from('invoices')
    .update({
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
    })
    .eq('id', id);
  if (error) {
    console.error('updateInvoice', error.message);
    return { error: 'Could not save the invoice.' };
  }
  revalidatePath(`/admin/invoices/${id}`);
  revalidatePath('/admin/invoices');
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
export async function addInvoicePayment(invoiceId: string, raw: unknown): Promise<{ error?: string; info?: string }> {
  const s = await staff();
  if (!s) return { error: 'You do not have access to invoices.' };
  const p = paymentSchema.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0]?.message ?? 'Please check the payment.' };
  const { data: inv } = await s.supabase
    .from('invoices')
    .select('id, invoice_number, status, balance_amount, customer_id')
    .eq('id', invoiceId)
    .maybeSingle();
  if (!inv) return { error: 'Invoice not found.' };
  if (inv.status === 'cancelled') return { error: 'This invoice is cancelled.' };
  if (p.data.amount > Number(inv.balance_amount) + 0.5) return { error: `Amount is more than the balance (₹${Number(inv.balance_amount).toLocaleString('en-IN')}).` };

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
  } else info = 'Payment recorded. Ask accounts to add it under Income.';

  const { error } = await s.supabase.from('invoice_payments').insert({ invoice_id: invoiceId, ...p.data, income_id: incomeId, created_by: s.profile.id });
  if (error) {
    if (incomeId) await s.supabase.from('income').delete().eq('id', incomeId);
    return { error: 'Could not record the payment.' };
  }

  // Recalculate total amount paid & ensure invoice amount_paid and status are synced in DB
  const { data: allPayments } = await s.supabase
    .from('invoice_payments')
    .select('amount')
    .eq('invoice_id', invoiceId);
  const totalPaid = (allPayments || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const { data: invRow } = await s.supabase
    .from('invoices')
    .select('total_amount, status')
    .eq('id', invoiceId)
    .single();
  if (invRow) {
    const totalAmount = Number(invRow.total_amount || 0);
    const newStatus =
      invRow.status === 'cancelled' || invRow.status === 'draft'
        ? invRow.status
        : totalPaid >= totalAmount
        ? 'paid'
        : totalPaid > 0
        ? 'partially_paid'
        : 'issued';
    await s.supabase
      .from('invoices')
      .update({
        amount_paid: totalPaid,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);
  }

  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath('/admin/invoices');
  revalidatePath('/admin/income');
  return { info };
}

export async function deleteInvoicePayment(invoiceId: string, paymentId: string) {
  const profile = await requireProfile();
  if (!isAdminRole(profile)) return { error: 'Only admins can delete payments.' };
  const supabase = await createClient();
  const { data: pay } = await supabase.from('invoice_payments').select('income_id').eq('id', paymentId).maybeSingle();
  const { error } = await supabase.from('invoice_payments').delete().eq('id', paymentId);
  if (error) return { error: 'Could not delete the payment.' };
  if (pay?.income_id) await supabase.from('income').delete().eq('id', pay.income_id);

  // Recalculate total amount paid & update invoice in DB
  const { data: allPayments } = await supabase
    .from('invoice_payments')
    .select('amount')
    .eq('invoice_id', invoiceId);
  const totalPaid = (allPayments || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const { data: invRow } = await supabase
    .from('invoices')
    .select('total_amount, status')
    .eq('id', invoiceId)
    .single();
  if (invRow) {
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

  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath('/admin/invoices');
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
  revalidatePath(`/admin/invoices/${id}`);
  revalidatePath('/admin/invoices');
  return {};
}
