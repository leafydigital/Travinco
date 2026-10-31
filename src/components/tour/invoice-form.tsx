'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { ALL_ZERO_PHONE_MESSAGE, isAllZeroPhone, isFakePhone } from '@/lib/validations/phone';
import { validateEmailAddress } from '@/lib/validations/contact-rules';
import { GSTIN_RE } from '@/lib/validations/finance';

export type InvoiceFormFields = {
  bill_to_name: string;
  bill_to_phone: string;
  bill_to_email: string;
  bill_to_address: string;
  bill_to_gstin: string;
  place_of_supply: string;
  invoice_date: string;
  due_date: string;
  travel_start: string;
  travel_end: string;
  discount: string;
  gst_pct: string;
  tax_mode: 'cgst_sgst' | 'igst';
  notes: string;
  terms: string;
  markup_pct: string;
  markup_amount: string;
};

export type InvoiceFormItem = { description: string; sac: string; qty: string; rate: string };

/** What the form hands to the server action (matches `invoiceSchema`). */
export type InvoiceFormPayload = Omit<InvoiceFormFields, 'markup_pct' | 'markup_amount'> & {
  markup_pct: number;
  markup_amount: number;
  items: InvoiceFormItem[];
};

type Errors = Record<string, string>;

const isNum = (v: string) => v.trim() !== '' && Number.isFinite(Number(v));

/** Field rules; the server re-checks all of these, this just tells the user before they submit. */
export function validateInvoiceForm(f: InvoiceFormFields, items: InvoiceFormItem[]): Errors {
  const e: Errors = {};
  const name = f.bill_to_name.trim();
  if (!name) e.bill_to_name = 'Bill-to name is required';
  else if (name.length > 150) e.bill_to_name = 'Keep the name under 150 characters';

  const phone = f.bill_to_phone.trim();
  if (!phone) e.bill_to_phone = 'Phone number is required';
  else {
    if (isAllZeroPhone(phone)) e.bill_to_phone = ALL_ZERO_PHONE_MESSAGE;
    else if (!isValidPhoneNumber(phone, 'IN') || isFakePhone(phone)) e.bill_to_phone = 'Enter a valid phone number';
  }
  if (f.bill_to_email.trim()) {
    const msg = validateEmailAddress(f.bill_to_email);
    if (msg) e.bill_to_email = msg;
  }
  if (f.bill_to_address.length > 2000) e.bill_to_address = 'Keep the address under 2000 characters';
  const gstin = f.bill_to_gstin.trim();
  if (gstin && !GSTIN_RE.test(gstin.toUpperCase())) e.bill_to_gstin = 'GSTIN must be 15 characters, like 32ABCDE1234F1Z5';
  if (f.place_of_supply.length > 60) e.place_of_supply = 'Keep this under 60 characters';

  if (!f.invoice_date) e.invoice_date = 'Invoice date is required';
  if (f.due_date && f.invoice_date && f.due_date < f.invoice_date) e.due_date = 'Cannot be before the invoice date';
  if (f.travel_start && f.travel_end && f.travel_end < f.travel_start) e.travel_end = 'Cannot be before travel start';

  if (!isNum(f.gst_pct) || Number(f.gst_pct) < 0 || Number(f.gst_pct) > 28) e.gst_pct = 'Enter 0 to 28';
  const subtotal = items.reduce((a, i) => a + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0);
  if (!isNum(f.discount) || Number(f.discount) < 0) e.discount = 'Enter 0 or more';
  else if (Number(f.discount) > subtotal) e.discount = 'More than the line total';
  if (f.markup_pct.trim() && (!isNum(f.markup_pct) || Number(f.markup_pct) < 0 || Number(f.markup_pct) > 100)) e.markup_pct = 'Enter 0 to 100';
  if (f.notes.length > 4000) e.notes = 'Keep notes under 4000 characters';
  if (f.terms.length > 4000) e.terms = 'Keep terms under 4000 characters';

  items.forEach((it, i) => {
    if (!it.description.trim()) e[`item.${i}.description`] = 'Description is required';
    else if (it.description.length > 1000) e[`item.${i}.description`] = 'Keep under 1000 characters';
    if (it.sac.trim().length > 10) e[`item.${i}.sac`] = 'Max 10 characters';
    if (!isNum(it.qty) || Number(it.qty) <= 0) e[`item.${i}.qty`] = 'More than 0';
    if (!isNum(it.rate) || Number(it.rate) < 0) e[`item.${i}.rate`] = '0 or more';
  });
  return e;
}

/** Blocks the characters a number field should never take (minus sign, exponent). */
const blockBadNumberKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault();
};

/** `iso` plus whole days, in UTC so it can't slip a day across time zones. */
const addDaysIso = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/**
 * The invoice fields shared by "Edit invoice" and "New invoice". The parent owns
 * saving (and the surrounding dialog or page); this owns the inputs, the live totals and validation.
 */
export function InvoiceForm({
  initialFields,
  initialItems,
  companyState,
  dueDays,
  submitLabel,
  pendingLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initialFields: InvoiceFormFields;
  initialItems: InvoiceFormItem[];
  companyState: string;
  /** When set, picking an invoice date fills an empty due date this many days later. */
  dueDays?: number;
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  onSubmit: (payload: InvoiceFormPayload) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState(initialFields);
  const [items, setItems] = useState(initialItems);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const set = (k: keyof InvoiceFormFields, v: string) => setF((s) => ({ ...s, [k]: v }));
  const touch = (k: string) => setTouched((t) => (t.has(k) ? t : new Set(t).add(k)));
  const errors = validateInvoiceForm(f, items);
  const err = (k: string) => (submitted || touched.has(k) ? errors[k] : undefined);

  const subtotal = items.reduce((a, i) => a + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0);
  const taxable = Math.max(0, subtotal - (Number(f.discount) || 0));
  const gstAmount = (taxable * (Number(f.gst_pct) || 0)) / 100;
  const total = Math.round(taxable + gstAmount);

  const markupPctVal = Number(f.markup_pct) || 0;
  const computedMarkup = markupPctVal > 0 ? Math.round((taxable * markupPctVal) / (100 + markupPctVal)) : 0;
  const currentMarkupAmount = Number(f.markup_amount) || computedMarkup;

  const submit = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) {
      // Bring the first problem into view
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    onSubmit({ ...f, markup_pct: markupPctVal, markup_amount: Number(f.markup_amount) || computedMarkup, items });
  };

  const fieldProps = (k: keyof InvoiceFormFields) => ({
    value: f[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value),
    onBlur: () => touch(k),
    'aria-invalid': err(k) ? (true as const) : undefined,
  });

  /** Label + control + inline error. `span` is the column span on medium screens and up. */
  const field = (k: keyof InvoiceFormFields, label: string, control: React.ReactNode, span = 1, hint?: string) => (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <label className="label !mb-1 !text-xs">{label}</label>
      {control}
      {err(k) ? <p className="mt-0.5 text-xs text-red-600">{err(k)}</p> : hint ? <p className="mt-0.5 text-xs text-ink-400">{hint}</p> : null}
    </div>
  );
  const text = (k: keyof InvoiceFormFields, label: string, o: { type?: string; span?: number; max?: number; step?: string } = {}) =>
    field(
      k,
      label,
      <input
        className="input py-1.5"
        type={o.type ?? 'text'}
        maxLength={o.max}
        {...(o.type === 'number' ? { min: 0, step: o.step ?? 'any', onKeyDown: blockBadNumberKeys } : {})}
        {...fieldProps(k)}
      />,
      o.span
    );

  const itemInput = (i: number, key: keyof InvoiceFormItem, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      className="input py-1.5"
      value={items[i]?.[key] ?? ''}
      onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, [key]: e.target.value } : x)))}
      onBlur={() => touch(`item.${i}.${key}`)}
      aria-invalid={err(`item.${i}.${key}`) ? true : undefined}
      {...props}
    />
  );
  const itemErr = (i: number, key: keyof InvoiceFormItem) =>
    err(`item.${i}.${key}`) ? <p className="mt-0.5 text-xs text-red-600">{err(`item.${i}.${key}`)}</p> : null;

  return (
    <>
      {/* Bill to + dates + tax: four columns so the whole header fits on one screen */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 md:grid-cols-4">
        {text('bill_to_name', 'Bill to *', { span: 2, max: 150 })}
        {text('bill_to_phone', 'Phone *', { type: 'tel', max: 30 })}
        {text('bill_to_email', 'Email', { type: 'email', max: 150 })}

        {field(
          'bill_to_address',
          'Address',
          <textarea className="input py-1.5" rows={2} maxLength={2000} {...fieldProps('bill_to_address')} />,
          2
        )}
        {text('bill_to_gstin', 'Customer GSTIN (B2B)', { max: 15 })}
        {field(
          'place_of_supply',
          'Place of supply',
          <input
            className="input py-1.5"
            maxLength={60}
            value={f.place_of_supply}
            onBlur={() => touch('place_of_supply')}
            aria-invalid={err('place_of_supply') ? true : undefined}
            onChange={(e) => {
              const v = e.target.value;
              setF((s) => ({ ...s, place_of_supply: v, tax_mode: v.trim().toLowerCase() === companyState.toLowerCase() ? 'cgst_sgst' : 'igst' }));
            }}
          />,
          1,
          `${companyState} → CGST+SGST, else IGST`
        )}

        {field(
          'invoice_date',
          'Invoice date *',
          <input
            className="input py-1.5"
            type="date"
            value={f.invoice_date}
            onBlur={() => touch('invoice_date')}
            aria-invalid={err('invoice_date') ? true : undefined}
            onChange={(e) => {
              const v = e.target.value;
              setF((s) => ({ ...s, invoice_date: v, due_date: !s.due_date && v && dueDays ? addDaysIso(v, dueDays) : s.due_date }));
            }}
          />
        )}
        {text('due_date', 'Due date', { type: 'date' })}
        {text('travel_start', 'Travel start', { type: 'date' })}
        {text('travel_end', 'Travel end', { type: 'date' })}

        {text('gst_pct', 'GST %', { type: 'number' })}
        {field(
          'tax_mode',
          'Tax type',
          <select className="input py-1.5" {...fieldProps('tax_mode')}>
            <option value="cgst_sgst">CGST + SGST</option>
            <option value="igst">IGST</option>
          </select>
        )}
        {text('discount', 'Discount (₹, pre-GST)', { type: 'number' })}
        {field(
          'markup_pct',
          'Markup %',
          <input
            className="input py-1.5"
            type="number"
            min={0}
            max={100}
            step="any"
            placeholder="15"
            onKeyDown={blockBadNumberKeys}
            value={f.markup_pct}
            onBlur={() => touch('markup_pct')}
            aria-invalid={err('markup_pct') ? true : undefined}
            onChange={(e) => {
              const val = e.target.value;
              const pct = Number(val) || 0;
              const amt = pct > 0 ? Math.round((taxable * pct) / (100 + pct)) : 0;
              setF((s) => ({ ...s, markup_pct: val, markup_amount: String(amt) }));
            }}
          />,
          1,
          `Markup ${inr(currentMarkupAmount)}`
        )}
      </div>

      {/* Line items */}
      <div className="mt-4">
        <div className="mb-1 hidden grid-cols-[minmax(0,1fr)_84px_64px_104px_92px_32px] gap-2 px-0.5 text-xs font-medium text-ink-500 sm:grid">
          <span>Description *</span>
          <span>SAC</span>
          <span>Qty</span>
          <span>Rate (pre-GST)</span>
          <span className="text-right">Amount</span>
          <span />
        </div>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-2 items-start gap-2 sm:grid-cols-[minmax(0,1fr)_84px_64px_104px_92px_32px]">
              <div className="col-span-2 sm:col-span-1">
                <textarea
                  className="input py-1.5"
                  rows={2}
                  maxLength={1000}
                  placeholder="Description"
                  value={it.description}
                  onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                  onBlur={() => touch(`item.${i}.description`)}
                  aria-invalid={err(`item.${i}.description`) ? true : undefined}
                />
                {itemErr(i, 'description')}
              </div>
              <div>
                {itemInput(i, 'sac', { placeholder: 'SAC', maxLength: 10 })}
                {itemErr(i, 'sac')}
              </div>
              <div>
                {itemInput(i, 'qty', { type: 'number', min: 0, step: 'any', placeholder: 'Qty', onKeyDown: blockBadNumberKeys })}
                {itemErr(i, 'qty')}
              </div>
              <div>
                {itemInput(i, 'rate', { type: 'number', min: 0, step: 'any', placeholder: 'Rate', onKeyDown: blockBadNumberKeys })}
                {itemErr(i, 'rate')}
              </div>
              <p className="py-1.5 text-right text-sm tabular-nums text-ink-700">{inr((Number(it.qty) || 0) * (Number(it.rate) || 0))}</p>
              <button
                type="button"
                className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                disabled={items.length === 1}
                onClick={() => setItems(items.filter((_, j) => j !== i))}
                aria-label="Remove line"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn-ghost px-3 py-1"
            onClick={() => setItems([...items, { description: '', sac: items[0]?.sac ?? '998555', qty: '1', rate: '0' }])}
          >
            <Plus className="h-4 w-4" /> Add line
          </button>
        </div>
      </div>

      {/* Totals */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-sm">
        <p className="text-ink-600">
          Taxable <b className="text-ink-900">{inr(taxable)}</b>
          <span className="mx-2 text-ink-300">·</span>
          GST ({Number(f.gst_pct) || 0}%) <b className="text-ink-900">{inr(gstAmount)}</b>
          <span className="mx-2 text-ink-300">·</span>
          <span className="text-emerald-700">Markup <b>{inr(currentMarkupAmount)}</b> ({markupPctVal}%)</span>
        </p>
        <p className="text-ink-600">
          Invoice total ≈ <b className="text-base text-ink-950">{inr(total)}</b>
        </p>
      </div>

      {/* Notes and terms side by side */}
      <div className="mt-3 grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
        {field('notes', 'Notes', <textarea className="input py-1.5" rows={2} maxLength={4000} {...fieldProps('notes')} />)}
        {field('terms', 'Terms', <textarea className="input py-1.5" rows={2} maxLength={4000} {...fieldProps('terms')} />)}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 border-t border-ink-100 pt-3">
        {submitted && Object.keys(errors).length > 0 && (
          <p className="mr-auto text-sm text-red-600">Fix the highlighted fields to continue.</p>
        )}
        <button type="button" className="btn-outline" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn-primary" disabled={pending} onClick={submit}>{pending ? pendingLabel : submitLabel}</button>
      </div>
    </>
  );
}
