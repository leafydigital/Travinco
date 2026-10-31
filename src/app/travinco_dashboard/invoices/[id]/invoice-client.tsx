'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/admin-alert';
import { DatePickerDMY } from '@/components/public/date-picker-dmy';
import { Ban, FileDown, Pencil, Printer, Trash2 } from 'lucide-react';
import { addInvoicePayment, cancelInvoice, deleteInvoice, deleteInvoicePayment, updateInvoice } from '../actions';
import { downloadPdf, downloadWord, printAsPdf } from '@/components/tour/doc-tools';
import { Dialog } from '@/components/admin/entity-manager';
import { ConfirmDeleteDialog } from '@/components/admin/confirm-delete-dialog';
import type { InvoiceDoc } from '@/components/tour/invoice-document';
import { InvoiceForm, type InvoiceFormFields, type InvoiceFormPayload } from '@/components/tour/invoice-form';

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
            action will remove it from the active invoices list.
          </>
        }
        onConfirm={() => {
          start(async () => {
            const r = await deleteInvoice(id);
            if (r.error) return void toast.error(r.error);
            toast.success('Invoice deleted successfully');
            setDeleteConfirmOpen(false);
            router.push('/travinco_dashboard/invoices');
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
  const initialFields: InvoiceFormFields = {
    bill_to_name: inv.bill_to_name,
    bill_to_phone: inv.bill_to_phone ?? '',
    bill_to_email: inv.bill_to_email ?? '',
    bill_to_address: inv.bill_to_address ?? '',
    bill_to_gstin: inv.bill_to_gstin ?? '',
    place_of_supply: inv.place_of_supply ?? companyState,
    invoice_date: inv.invoice_date,
    due_date: inv.due_date ?? '',
    travel_start: inv.travel_start ?? '',
    travel_end: inv.travel_end ?? '',
    discount: String(inv.discount ?? 0),
    gst_pct: String(inv.gst_pct),
    tax_mode: inv.tax_mode,
    notes: inv.notes ?? '',
    terms: inv.terms ?? '',
    markup_pct: String(inv.markup_pct ?? 15),
    markup_amount: String(inv.markup_amount ?? ''),
  };
  const initialItems = inv.items.map((i) => {
    const isSingle = inv.items.length === 1;
    const rateVal = isSingle && Math.abs(Number(i.rate) * (Number(i.qty) || 1) - Number(inv.total_amount)) > 1
      ? Number(inv.total_amount) / (Number(i.qty) || 1)
      : Number(i.rate);
    return { description: i.description, sac: i.sac, qty: String(i.qty), rate: String(rateVal) };
  });

  const save = (payload: InvoiceFormPayload) =>
    start(async () => {
      const r = await updateInvoice(id, payload);
      if (r.error) return void toast.error(r.error);
      toast.success('Invoice saved');
      onClose();
      router.refresh();
    });

  return (
    <Dialog title={`Edit ${inv.invoice_number}`} onClose={onClose} wide>
      <InvoiceForm
        initialFields={initialFields}
        initialItems={initialItems}
        companyState={companyState}
        submitLabel="Save invoice"
        pendingLabel="Saving…"
        pending={pending}
        onSubmit={save}
        onCancel={onClose}
      />
    </Dialog>
  );
}

type Payment = { id: string; paid_on: string; amount: number; method: string; reference: string | null; notes: string | null; income_id: string | null };

export function PaymentsPanel({
  id,
  payments: initialPayments,
  balance: initialBalance,
  totalAmount,
  amountPaid: initialAmountPaid,
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
  const [paymentsList, setPaymentsList] = useState<Payment[]>(initialPayments);
  const [pending, start] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ paid_on: today, amount: '', method: 'upi', reference: '', notes: '' });

  useEffect(() => {
    setPaymentsList(initialPayments);
  }, [initialPayments]);

  const computedTotal = totalAmount ?? (initialBalance + (initialAmountPaid ?? 0));
  const computedPaid = paymentsList.reduce((s, p) => s + Number(p.amount || 0), 0);
  const balance = Math.max(0, computedTotal - computedPaid);

  const enteredAmount = Number(f.amount) || 0;
  const newBalance = Math.max(0, balance - enteredAmount);

  const add = () => {
    if (pending || !(enteredAmount > 0)) return;
    const payload = { ...f };

    start(async () => {
      const r = await addInvoicePayment(id, payload);
      if (r.error) {
        return void toast.error(r.error);
      }
      toast.success('Payment recorded successfully');
      if (r.info) toast.message(r.info);
      if (r.payment) {
        setPaymentsList((prev) => [...prev, r.payment!]);
      }
      setF({ paid_on: today, amount: '', method: f.method, reference: '', notes: '' });
      router.refresh();
    });
  };

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
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">Payment History ({paymentsList.length})</p>
        <ul className="space-y-2 text-sm max-h-52 overflow-y-auto">
          {paymentsList.length === 0 && <li className="text-ink-400 text-xs py-2 text-center bg-ink-50/50 rounded-lg">No payments recorded yet.</li>}
          {paymentsList.map((p) => (
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
                  disabled={deleting}
                  onClick={() => setPaymentToDelete(p)}
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
              <DatePickerDMY size="sm" value={f.paid_on} onChange={(iso) => setF({ ...f, paid_on: iso })} label="Payment date" />
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

      <ConfirmDeleteDialog
        isOpen={Boolean(paymentToDelete)}
        isPending={deleting}
        title="Delete Payment"
        description={
          paymentToDelete ? (
            <>
              Are you sure you want to delete the payment of{' '}
              <strong className="text-ink-900">
                ₹{Number(paymentToDelete.amount).toLocaleString('en-IN')}
              </strong>
              {paymentToDelete.reference ? (
                <> (Ref: <span className="font-mono">{paymentToDelete.reference}</span>)</>
              ) : null}
              {paymentToDelete.income_id ? ' and its corresponding Income entry' : ''}?
              This action cannot be undone.
            </>
          ) : null
        }
        confirmLabel="Delete Payment"
        onConfirm={() => {
          if (!paymentToDelete) return;
          const target = paymentToDelete;

          startDelete(async () => {
            const r = await deleteInvoicePayment(id, target.id);
            if (r.error) {
              return void toast.error(r.error);
            }
            setPaymentsList((prev) => prev.filter((p) => p.id !== target.id));
            setPaymentToDelete(null);
            toast.success('Payment deleted successfully');
            router.refresh();
          });
        }}
        onClose={() => {
          if (!deleting) setPaymentToDelete(null);
        }}
      />
    </div>
  );
}
