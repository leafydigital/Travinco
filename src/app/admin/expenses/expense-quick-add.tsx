'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { createExpense } from '../finance-actions';

export function ExpenseQuickAdd({ categories }: { categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    category_id: categories[0]?.id ?? '',
    supplier: '',
    description: '',
    amount: '',
    payment_method: 'bank_transfer' as const,
    reference_number: '',
  });

  function submit() {
    if (!form.category_id) {
      toast.error('Select a category — add one in Settings if none exist yet.');
      return;
    }
    startTransition(async () => {
      const result = await createExpense(form);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Expense recorded');
      setForm((f) => ({ ...f, supplier: '', description: '', amount: '', reference_number: '' }));
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
      {categories.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No expense categories yet — add some from Settings → Finance first.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          type="date"
          value={form.expense_date}
          onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
          className="input"
        />
        <select
          value={form.category_id}
          onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
          className="input"
        >
          <option value="">Select category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
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
        <input
          value={form.supplier}
          onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
          placeholder="Supplier"
          className="input"
        />
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
