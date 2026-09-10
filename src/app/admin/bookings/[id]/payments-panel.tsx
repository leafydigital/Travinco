'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { recordPayment, deletePayment } from '../actions';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { Trash2 } from 'lucide-react';
import type { Tables } from '@/types/database';

export function PaymentsPanel({
  bookingId,
  payments,
  canDelete,
}: {
  bookingId: string;
  payments: Tables<'payments'>[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    amount: '',
    payment_method: 'bank_transfer' as const,
    payment_date: new Date().toISOString().slice(0, 10),
    reference_number: '',
    notes: '',
  });

  function submit() {
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('Enter a valid amount.');
      return;
    }
    startTransition(async () => {
      const result = await recordPayment(bookingId, form);
      if ('error' in result && result.error) {
        toast.error(result.error);
        return;
      }
      if ('warning' in result && result.warning) {
        toast.warning(result.warning);
      } else {
        toast.success('Payment recorded');
      }
      setForm({
        amount: '',
        payment_method: 'bank_transfer',
        payment_date: new Date().toISOString().slice(0, 10),
        reference_number: '',
        notes: '',
      });
      router.refresh();
    });
  }

  function remove(paymentId: string) {
    if (!confirm('Delete this payment record?')) return;
    startTransition(async () => {
      const result = await deletePayment(bookingId, paymentId);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="card space-y-4 p-5">
      <h2 className="text-sm font-semibold text-ink-800">Payments</h2>

      <div className="space-y-2">
        {payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-lg border border-ink-100 p-2.5 text-sm">
            <div>
              <p className="font-medium text-ink-700">{formatCurrency(p.amount)}</p>
              <p className="text-xs text-ink-400">
                {formatDate(p.payment_date)} · {p.payment_method.replace('_', ' ')}
                {p.reference_number && ` · Ref: ${p.reference_number}`}
              </p>
            </div>
            {canDelete && (
              <button
                onClick={() => remove(p.id)}
                disabled={isPending}
                className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                aria-label="Delete payment"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {payments.length === 0 && <p className="text-sm text-ink-400">No payments recorded yet.</p>}
      </div>

      <div className="grid gap-2 border-t border-ink-100 pt-3 sm:grid-cols-2">
        <input
          type="number"
          min={0.01}
          step="0.01"
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          placeholder="Amount"
          className="input"
        />
        <input
          type="date"
          value={form.payment_date}
          onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))}
          className="input"
        />
        <select
          value={form.payment_method}
          onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value as typeof f.payment_method }))}
          className="input"
        >
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="upi">UPI</option>
          <option value="credit_card">Credit card</option>
          <option value="debit_card">Debit card</option>
          <option value="cheque">Cheque</option>
          <option value="other">Other</option>
        </select>
        <input
          value={form.reference_number}
          onChange={(e) => setForm((f) => ({ ...f, reference_number: e.target.value }))}
          placeholder="Reference number"
          className="input"
        />
      </div>
      <button onClick={submit} disabled={isPending} className="btn-primary w-full">
        {isPending ? 'Recording…' : 'Record payment'}
      </button>
    </div>
  );
}
