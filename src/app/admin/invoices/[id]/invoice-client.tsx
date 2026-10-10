'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Ban, FileDown, Pencil, Plus, Printer, Trash2, X } from 'lucide-react';
import { addInvoicePayment, cancelInvoice, deleteInvoice, deleteInvoicePayment, updateInvoice } from '../actions';
import { downloadPdf, downloadWord, printAsPdf } from '@/components/tour/doc-tools';
import { Dialog } from '@/components/admin/entity-manager';
import { ConfirmDeleteDialog } from '@/components/admin/confirm-delete-dialog';
import type { InvoiceDoc } from '@/components/tour/invoice-document';

const METHODS = [
  ['upi', 'UPI'], ['bank_transfer', 'Bank transfer'], ['cash', 'Cash'], ['credit_card', 'Credit card'],
  ['debit_card', 'Debit card'], ['cheque', 'Cheque'], ['other', 'Other'],
] as const;

export function InvoiceToolbar({ id, inv, fileName, canCancel, companyState, isAdmin }: { id: string; inv: InvoiceDoc; fileName: string; canCancel: boolean; companyState: string; isAdmin?: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pending, start] = useTransition();
  const cancelled = inv.status === 'cancelled';
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button type="button" className="btn-primary" onClick={() => downloadPdf('invoice-doc', fileName)}>
        <FileDown className="h-4 w-4" /> Download PDF
      </button>
      <button type="button" className="btn-outline" onClick={() => printAsPdf(fileName)}>
        <Printer className="h-4 w-4" /> Print
      </button>
      <button type="button" className="btn-outline" onClick={() => downloadWord('invoice-doc', fileName)}>
        <FileDown className="h-4 w-4" /> Word
      </button>
      {!cancelled && (
        <button type="button" className="btn-outline" onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4" /> Edit invoice
        </button>
      )}
      {!cancelled && canCancel && (
        <button
          type="button"
          className="btn-ghost text-red-600"
          disabled={pending}
          onClick={() => {
            if (!window.confirm('Cancel this invoice? The quotation goes back to "accepted" so it can be invoiced again.')) return;
            start(async () => {
              const r = await cancelInvoice(id);
              if (r.error) return void toast.error(r.error);
              toast.success('Invoice cancelled');
              router.refresh();
            });
          }}
        >
          <Ban className="h-4 w-4" /> Cancel invoice
        </button>
      )}
      {isAdmin && (
        <button
          type="button"
          className="btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700"
          disabled={pending}
          onClick={() => setDeleteConfirmOpen(true)}
        >
          <Trash2 className="h-4 w-4" /> Delete invoice
        </button>
      )}
      {editing && <InvoiceEditor id={id} inv={inv} companyState={companyState} onClose={() => setEditing(false)} />}

      <ConfirmDeleteDialog
        isOpen={deleteConfirmOpen}
        isPending={pending}
        title="Delete Invoice"
        description={
          <>
            Are you sure you want to delete invoice{' '}
            <strong className="text-ink-900">{inv.invoice_number}</strong>? This
            action will permanently remove it and any associated payment records
            from the database. This cannot be undone.
          </>
        }
        onConfirm={() => {
          start(async () => {
            const r = await deleteInvoice(id);
            if (r.error) return void toast.error(r.error);
            toast.success('Invoice deleted successfully');
            setDeleteConfirmOpen(false);
            router.push('/admin/invoices');
          });
        }}
        onClose={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}

function InvoiceEditor({ id, inv, companyState, onClose }: { id: string; inv: InvoiceDoc; companyState: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    bill_to_name: inv.bill_to_name,
    bill_to_phone: inv.bill_to_phone ?? '',
    bill_to_email: inv.bill_to_email ?? '',
    bill_to_address: inv.bill_to_address ?? '',
    bill_to_gstin: inv.bill_to_gstin ?? '',
    place_of_supply: inv.place_of_supply ?? companyState,
    invoice_date: inv.invoice_date,
    due_date: inv.due_date ?? '',
    discount: String(inv.discount ?? 0),
    gst_pct: String(inv.gst_pct),
    tax_mode: inv.tax_mode,
    notes: inv.notes ?? '',
    terms: inv.terms ?? '',
  });
  const [items, setItems] = useState(inv.items.map((i) => ({ description: i.description, sac: i.sac, qty: String(i.qty), rate: String(i.rate) })));
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const subtotal = items.reduce((a, i) => a + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0);
  const taxable = Math.max(0, subtotal - (Number(f.discount) || 0));
  const total = Math.round(taxable * (1 + (Number(f.gst_pct) || 0) / 100));

  const save = () =>
    start(async () => {
      const r = await updateInvoice(id, { ...f, items });
      if (r.error) return void toast.error(r.error);
      toast.success('Invoice saved');
      onClose();
      router.refresh();
    });

  const input = (k: keyof typeof f, label: string, type = 'text', span = false) => (
    <div className={span ? 'sm:col-span-2' : ''}>
      <label className="label">{label}</label>
      <input className="input" type={type} value={f[k]} onChange={(e) => set(k, e.target.value)} />
    </div>
  );

  return (
    <Dialog title={`Edit ${inv.invoice_number}`} onClose={onClose} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        {input('bill_to_name', 'Bill to *', 'text', true)}
        {input('bill_to_phone', 'Phone', 'tel')}
        {input('bill_to_email', 'Email', 'email')}
        <div className="sm:col-span-2">
          <label className="label">Address</label>
          <textarea className="input" rows={2} value={f.bill_to_address} onChange={(e) => set('bill_to_address', e.target.value)} />
        </div>
        {input('bill_to_gstin', 'Customer GSTIN (B2B)')}
        <div>
          <label className="label">Place of supply</label>
          <input
            className="input"
            value={f.place_of_supply}
            onChange={(e) => {
              const v = e.target.value;
              setF((s) => ({ ...s, place_of_supply: v, tax_mode: v.trim().toLowerCase() === companyState.toLowerCase() ? 'cgst_sgst' : 'igst' }));
            }}
          />
          <p className="mt-1 text-xs text-ink-400">{companyState} → CGST + SGST, other states → IGST</p>
        </div>
        {input('invoice_date', 'Invoice date', 'date')}
        {input('due_date', 'Due date', 'date')}
        <div>
          <label className="label">GST %</label>
          <input className="input" type="number" step="any" value={f.gst_pct} onChange={(e) => set('gst_pct', e.target.value)} />
        </div>
        <div>
          <label className="label">Tax type</label>
          <select className="input" value={f.tax_mode} onChange={(e) => set('tax_mode', e.target.value)}>
            <option value="cgst_sgst">CGST + SGST (intra-state)</option>
            <option value="igst">IGST (inter-state)</option>
          </select>
        </div>
      </div>

      <div className="mt-5">
        <p className="label">Line items (amounts before GST)</p>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_90px_70px_120px_auto]">
              <textarea className="input" rows={2} value={it.description} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} placeholder="Description" />
              <input className="input" value={it.sac} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, sac: e.target.value } : x)))} placeholder="SAC" />
              <input className="input" type="number" step="any" value={it.qty} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} placeholder="Qty" />
              <input className="input" type="number" step="any" value={it.rate} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)))} placeholder="Rate" />
              <button type="button" className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600" disabled={items.length === 1} onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Remove line">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button type="button" className="btn-ghost px-3 py-1.5" onClick={() => setItems([...items, { description: '', sac: items[0]?.sac ?? '998555', qty: '1', rate: '0' }])}>
            <Plus className="h-4 w-4" /> Add line
          </button>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {input('discount', 'Discount (₹, before GST)', 'number')}
          <div className="rounded-lg bg-ink-50 p-3 text-sm">
            Taxable ₹{taxable.toLocaleString('en-IN')} · Total ≈ <b>₹{total.toLocaleString('en-IN')}</b>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Terms</label>
            <textarea className="input" rows={2} value={f.terms} onChange={(e) => set('terms', e.target.value)} />
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t border-ink-100 pt-4">
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={pending} onClick={save}>{pending ? 'Saving…' : 'Save invoice'}</button>
      </div>
    </Dialog>
  );
}

type Payment = { id: string; paid_on: string; amount: number; method: string; reference: string | null; notes: string | null; income_id: string | null };

export function PaymentsPanel({
  id,
  payments,
  balance,
  totalAmount,
  amountPaid,
  cancelled,
  isAdmin,
}: {
  id: string;
  payments: Payment[];
  balance: number;
  totalAmount?: number;
  amountPaid?: number;
  cancelled: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ paid_on: today, amount: '', method: 'upi', reference: '', notes: '' });

  const enteredAmount = Number(f.amount) || 0;
  const newBalance = Math.max(0, balance - enteredAmount);

  const add = () =>
    start(async () => {
      const r = await addInvoicePayment(id, f);
      if (r.error) return void toast.error(r.error);
      toast.success('Payment recorded successfully');
      if (r.info) toast.message(r.info);
      setF({ paid_on: today, amount: '', method: f.method, reference: '', notes: '' });
      router.refresh();
    });

  const computedTotal = totalAmount ?? (balance + (amountPaid ?? 0));
  const computedPaid = amountPaid ?? (payments.reduce((s, p) => s + Number(p.amount || 0), 0));

  return (
    <div className="card p-5 space-y-4 print:hidden">
      <div className="flex items-center justify-between border-b border-ink-100 pb-3">
        <h2 className="font-semibold text-ink-900 text-base">Payment Status</h2>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            balance <= 0
              ? 'bg-green-100 text-green-800'
              : computedPaid > 0
              ? 'bg-amber-100 text-amber-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {balance <= 0 ? 'Fully Paid' : computedPaid > 0 ? 'Partially Paid' : 'Payment Pending'}
        </span>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-ink-50 p-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-ink-500">Total</p>
          <p className="mt-0.5 text-sm font-bold text-ink-900 tabular-nums">₹{Math.round(computedTotal).toLocaleString('en-IN')}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 p-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-700">Paid</p>
          <p className="mt-0.5 text-sm font-bold text-emerald-800 tabular-nums">₹{Math.round(computedPaid).toLocaleString('en-IN')}</p>
        </div>
        <div className={`rounded-lg p-2.5 ${balance > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
          <p className={`text-[11px] font-medium uppercase tracking-wider ${balance > 0 ? 'text-amber-700' : 'text-green-700'}`}>Remaining</p>
          <p className={`mt-0.5 text-sm font-bold tabular-nums ${balance > 0 ? 'text-amber-900' : 'text-green-900'}`}>
            ₹{Math.round(balance).toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* Payment History List */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">Payment History ({payments.length})</p>
        <ul className="space-y-2 text-sm max-h-52 overflow-y-auto">
          {payments.length === 0 && <li className="text-ink-400 text-xs py-2 text-center bg-ink-50/50 rounded-lg">No payments recorded yet.</li>}
          {payments.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-2 rounded-lg border border-ink-100 bg-white p-2.5 shadow-sm">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <b className="tabular-nums text-ink-900">₹{Number(p.amount).toLocaleString('en-IN')}</b>
                  <span className="inline-flex rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
                    {METHODS.find((m) => m[0] === p.method)?.[1] ?? p.method}
                  </span>
                </div>
                <p className="text-xs text-ink-500">Date: {p.paid_on}</p>
                {p.reference && <p className="text-xs text-ink-600">Ref / UTR: <span className="font-mono">{p.reference}</span></p>}
                {p.notes && <p className="text-xs text-ink-500 italic">&ldquo;{p.notes}&rdquo;</p>}
                {p.income_id && <p className="text-[10px] font-medium text-emerald-700">✓ Booked in Income</p>}
              </div>
              {isAdmin && (
                <button
                  type="button"
                  className="rounded p-1 text-ink-400 hover:text-red-600 transition-colors"
                  aria-label="Delete payment"
                  title="Delete payment"
                  onClick={() =>
                    window.confirm('Delete this payment (and its Income entry)?') &&
                    start(async () => {
                      const r = await deleteInvoicePayment(id, p.id);
                      if (r.error) return void toast.error(r.error);
                      toast.success('Payment deleted');
                      router.refresh();
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Record Payment Form */}
      {!cancelled && balance > 0 && (
        <div className="border-t border-ink-100 pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-700">Record New Payment</p>
            <span className="text-xs text-ink-500">Max: ₹{Math.round(balance).toLocaleString('en-IN')}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-ink-600 block mb-1">Date</label>
              <input className="input text-xs py-1.5" type="date" value={f.paid_on} onChange={(e) => setF({ ...f, paid_on: e.target.value })} aria-label="Date" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-ink-600 block mb-1">Payment Method</label>
              <select className="input text-xs py-1.5" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} aria-label="Method">
                {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-medium text-ink-600 block mb-1">Amount to Pay (₹)</label>
              <input
                className="input text-sm font-semibold tabular-nums"
                type="number"
                min={0}
                max={balance}
                step="any"
                placeholder={`₹ (Balance: ${Math.round(balance)})`}
                value={f.amount}
                onChange={(e) => setF({ ...f, amount: e.target.value })}
                aria-label="Amount"
              />
            </div>
          </div>

          {/* Real-time remaining calculation */}
          {enteredAmount > 0 && (
            <div className={`rounded-lg p-2.5 text-xs ${enteredAmount >= balance ? 'bg-emerald-50 text-emerald-800' : 'bg-sand-50 text-sand-900'}`}>
              <div className="flex justify-between items-center font-medium">
                <span>Entering: ₹{enteredAmount.toLocaleString('en-IN')}</span>
                <span>Remaining: <b>₹{newBalance.toLocaleString('en-IN')}</b></span>
              </div>
              {enteredAmount >= balance && (
                <p className="mt-1 text-[11px] text-emerald-700 font-semibold">✓ This will mark the invoice as FULLY PAID.</p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className="btn-outline px-2.5 py-1 text-xs"
              onClick={() => setF({ ...f, amount: String(Math.round(balance * 100) / 100) })}
            >
              Full Balance (₹{Math.round(balance).toLocaleString('en-IN')})
            </button>
            {balance > 100 && (
              <button
                type="button"
                className="btn-outline px-2.5 py-1 text-xs"
                onClick={() => setF({ ...f, amount: String(Math.round((balance / 2) * 100) / 100) })}
              >
                50% (₹{Math.round(balance / 2).toLocaleString('en-IN')})
              </button>
            )}
          </div>

          <div className="space-y-2">
            <input
              className="input text-xs"
              placeholder="Reference / UTR Number (optional)"
              value={f.reference}
              onChange={(e) => setF({ ...f, reference: e.target.value })}
            />
            <input
              className="input text-xs"
              placeholder="Notes / Remarks (optional)"
              value={f.notes}
              onChange={(e) => setF({ ...f, notes: e.target.value })}
            />
          </div>

          <button
            type="button"
            className="btn-primary w-full justify-center py-2 text-sm font-semibold"
            disabled={pending || !(enteredAmount > 0)}
            onClick={add}
          >
            {pending ? 'Recording Payment…' : `Record Payment (₹${enteredAmount ? enteredAmount.toLocaleString('en-IN') : '0'})`}
          </button>
        </div>
      )}
    </div>
  );
}
