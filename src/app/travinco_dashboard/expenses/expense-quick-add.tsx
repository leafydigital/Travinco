'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { createExpense } from '../finance-actions';
import { blockNonNumericKeys, parseNonNegative } from '@/components/admin/package-fields';
import { PaymentMethodField } from './payment-method-field';

export function ExpenseQuickAdd(_props: { categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    category_id: '',
    supplier: '',
    description: '',
    amount: '',
    payment_method: 'bank_transfer',
    reference_number: '',
  });

  function submit() {
    if (!form.category_id.trim()) {
      toast.error('Please enter an expense category.');
      return;
    }
    const amount = Number(form.amount);
    if (!form.amount || !Number.isFinite(amount) || amount <= 0) {
      toast.error('Amount must be greater than 0.');
      return;
    }
    if (!form.payment_method.trim()) {
      toast.error('Please enter a payment method.');
      return;
    }
    startTransition(async () => {
      const result = await createExpense(form);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Expense recorded');
      setForm((f) => ({ ...f, category_id: '', supplier: '', description: '', amount: '', reference_number: '' }));
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="h-4 w-4" /> Add expense
      </button>
    );
  }

  return (
    <div className="card space-y-3 p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          type="date"
          value={form.expense_date}
          onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
          className="input"
        />
        <input
          type="text"
          value={form.category_id}
          onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
          placeholder="Category (e.g. Hotel, Transport)"
          autoComplete="off"
          className="input w-full"
          required
        />
        <input
          type="number"
          min={0.01}
          step="0.01"
          inputMode="decimal"
          value={form.amount}
          onKeyDown={(e) => blockNonNumericKeys(e)}
          onChange={(e) => {
            if (parseNonNegative(e.target.value) !== null) {
              setForm((f) => ({ ...f, amount: e.target.value }));
            }
          }}
          placeholder="Amount"
          className="input"
        />
        <input
          value={form.supplier}
          onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
          placeholder="Supplier"
          className="input"
        />
        <PaymentMethodField
          value={form.payment_method}
          onChange={(v) => setForm((f) => ({ ...f, payment_method: v }))}
        />
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
          className="input sm:col-span-3"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={() => setOpen(false)} className="btn-ghost">
          Cancel
        </button>
        <button onClick={submit} disabled={isPending} className="btn-primary">
          {isPending ? 'Saving…' : 'Save expense'}
        </button>
      </div>
    </div>
  );
}
