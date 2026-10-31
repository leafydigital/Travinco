'use client';

import { useState, useTransition, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/admin-alert';
import { DatePickerDMY } from '@/components/public/date-picker-dmy';
import { X, Loader2, Receipt } from 'lucide-react';
import { updateExpense } from '../finance-actions';
import { blockNonNumericKeys, parseNonNegative } from '@/components/admin/package-fields';
import { decodePaymentMethod } from '@/lib/payment-methods';
import { PaymentMethodField } from './payment-method-field';

interface ExpenseEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: { id: string; name: string }[];
  expense: {
    id: string;
    expense_number: string;
    expense_date: string;
    category_id: string;
    supplier?: string | null;
    description?: string | null;
    amount: number | string;
    payment_method: string;
    reference_number?: string | null;
    notes?: string | null;
    expense_categories?: { name: string } | { name: string }[] | null;
  };
}

function getInitialCategoryName(
  expense: ExpenseEditModalProps['expense'],
  categories: { id: string; name: string }[]
): string {
  const rel = expense.expense_categories;
  const fromRel = Array.isArray(rel) ? rel[0]?.name : rel?.name;
  if (fromRel) return fromRel;
  const match = categories.find((c) => c.id === expense.category_id);
  return match?.name || expense.category_id || '';
}

export function ExpenseEditModal({
  isOpen,
  onClose,
  categories,
  expense,
}: ExpenseEditModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    expense_date: expense.expense_date
      ? new Date(expense.expense_date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    category_id: getInitialCategoryName(expense, categories),
    supplier: expense.supplier || '',
    description: expense.description || '',
    amount: String(expense.amount || ''),
    payment_method: decodePaymentMethod(expense.payment_method, expense.notes),
    reference_number: expense.reference_number || '',
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setForm({
        expense_date: expense.expense_date
          ? new Date(expense.expense_date).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        category_id: getInitialCategoryName(expense, categories),
        supplier: expense.supplier || '',
        description: expense.description || '',
        amount: String(expense.amount || ''),
        payment_method: decodePaymentMethod(expense.payment_method, expense.notes),
        reference_number: expense.reference_number || '',
      });
    }
  }, [isOpen, expense, categories]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, isPending, onClose]);

  if (!isOpen || !mounted) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category_id.trim()) {
      toast.error('Please enter an expense category.');
      return;
    }
    const numAmount = parseFloat(form.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Amount must be greater than 0.');
      return;
    }
    if (!form.payment_method.trim()) {
      toast.error('Please enter a payment method.');
      return;
    }

    startTransition(async () => {
      const result = await updateExpense(expense.id, {
        expense_date: form.expense_date,
        category_id: form.category_id.trim(),
        supplier: form.supplier.trim() || null,
        description: form.description.trim() || null,
        amount: numAmount,
        payment_method: form.payment_method,
        reference_number: form.reference_number.trim() || null,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success('Expense updated successfully');
      onClose();
      router.refresh();
    });
  }

  const modalContent = (
    <div
      className="fixed inset-0 bg-ink-950/50 z-[9999] flex items-center justify-center p-4 transition-opacity animate-in fade-in duration-150"
      onClick={() => {
        if (!isPending) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg shadow-ink-900/5 transition-all animate-in zoom-in-95 duration-200 border border-ink-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink-900">Edit Expense</h2>
              <p className="text-xs text-ink-500 font-mono">{expense.expense_number}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
  
        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Date *</label>
              <DatePickerDMY
                value={form.expense_date}
                onChange={(iso) => setForm((f) => ({ ...f, expense_date: iso }))}
                label="Expense date"
              />
            </div>
            <div>
              <label className="label">Category *</label>
              <input
                type="text"
                required
                autoComplete="off"
                value={form.category_id}
                onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                placeholder="e.g. Hotel, Transport, Marketing"
                className="input"
              />
            </div>
            <div>
              <label className="label">Amount (₹) *</label>
              <input
                type="number"
                required
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
                placeholder="0.00"
                className="input"
              />
            </div>
            <div>
              <label className="label">Supplier / Payee</label>
              <input
                type="text"
                value={form.supplier}
                onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
                placeholder="Supplier name"
                className="input"
              />
            </div>
            <div>
              <label className="label">Payment Method *</label>
              <PaymentMethodField
                key={`${expense.id}-${isOpen}`}
                value={form.payment_method}
                onChange={(v) => setForm((f) => ({ ...f, payment_method: v }))}
              />
            </div>
            <div>
              <label className="label">Reference / Voucher #</label>
              <input
                type="text"
                value={form.reference_number}
                onChange={(e) => setForm((f) => ({ ...f, reference_number: e.target.value }))}
                placeholder="Voucher or TXN ref"
                className="input"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description / Purpose</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Details of expense..."
                className="input"
              />
            </div>
          </div>
  
          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 border-t border-ink-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="btn-primary"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
