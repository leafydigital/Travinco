'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { createIncome } from '../finance-actions';

export function IncomeQuickAdd({
  customers,
  bookings,
}: {
  customers: { id: string; full_name: string }[];
  bookings: { id: string; booking_number: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    income_date: new Date().toISOString().slice(0, 10),
    category: 'package_booking' as const,
    description: '',
    customer_id: '',
    booking_id: '',
    amount: '',
    payment_method: 'bank_transfer' as const,
    reference_number: '',
  });

  function submit() {
    startTransition(async () => {
      const result = await createIncome(form);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Income recorded');
      setForm((f) => ({ ...f, description: '', amount: '', reference_number: '' }));
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="h-4 w-4" /> Add income
      </button>
    );
  }

  return (
    <div className="card space-y-3 p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          type="date"
          value={form.income_date}
          onChange={(e) => setForm((f) => ({ ...f, income_date: e.target.value }))}
          className="input"
        />
        <select
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as typeof f.category }))}
          className="input"
        >
          <option value="package_booking">Package booking</option>
          <option value="flight">Flight</option>
          <option value="hotel">Hotel</option>
          <option value="transport">Transport</option>
          <option value="visa">Visa</option>
          <option value="service_charge">Service charge</option>
          <option value="other">Other</option>
        </select>
        <input
          type="number"
          min={0.01}
          step="0.01"
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          placeholder="Amount"
          className="input"
        />
        <select
          value={form.customer_id}
          onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
          className="input"
        >
          <option value="">No customer linked</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </select>
        <select
          value={form.booking_id}
          onChange={(e) => setForm((f) => ({ ...f, booking_id: e.target.value }))}
          className="input"
        >
          <option value="">No booking linked</option>
          {bookings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.booking_number}
            </option>
          ))}
        </select>
        <select
          value={form.payment_method}
          onChange={(e) =>
            setForm((f) => ({ ...f, payment_method: e.target.value as typeof f.payment_method }))
          }
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
        <input
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Description"
          className="input sm:col-span-2"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={() => setOpen(false)} className="btn-ghost">
          Cancel
        </button>
        <button onClick={submit} disabled={isPending} className="btn-primary">
          {isPending ? 'Saving…' : 'Save income'}
        </button>
      </div>
    </div>
  );
}
