'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/admin-alert';
import { Pencil, Trash2, Receipt } from 'lucide-react';
import { deleteExpense } from '../finance-actions';
import { ConfirmDeleteDialog } from '@/components/admin/confirm-delete-dialog';
import { ExpenseEditModal } from './expense-edit-modal';
import { formatCurrency } from '@/lib/utils/format';

interface ExpenseRowActionsProps {
  row: {
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
  categories: { id: string; name: string }[];
  canEdit?: boolean;
  isAdmin?: boolean;
}

export function ExpenseRowActions({
  row,
  categories,
  canEdit = true,
  isAdmin = false,
}: ExpenseRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const categoryName = (() => {
    const cat = row.expense_categories;
    return (Array.isArray(cat) ? cat[0]?.name : cat?.name) ?? 'Expense';
  })();

  function handleConfirmDelete() {
    startTransition(async () => {
      const result = await deleteExpense(row.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Expense deleted successfully');
        setIsDeleteOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        {/* Edit Button */}
        {canEdit && (
          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            className="group relative inline-flex items-center justify-center rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900 transition-colors cursor-pointer"
            aria-label="Edit expense"
            title="Edit expense"
          >
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 z-30">
              Edit expense
            </span>
            <Pencil className="h-4 w-4" />
          </button>
        )}

        {/* Delete Button */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setIsDeleteOpen(true)}
            disabled={isPending}
            className="group relative inline-flex items-center justify-center rounded-lg p-1.5 text-coral-600 hover:bg-coral-50 hover:text-coral-700 transition-colors disabled:opacity-40 cursor-pointer"
            aria-label="Delete expense"
            title="Delete expense"
          >
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 z-30">
              Delete expense
            </span>
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Edit Modal */}
      {isEditOpen && (
        <ExpenseEditModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          categories={categories}
          expense={row}
        />
      )}

      {/* Delete Confirmation Popup Modal */}
      <ConfirmDeleteDialog
        isOpen={isDeleteOpen}
        isPending={isPending}
        title="Delete Expense"
        confirmLabel="Delete Expense"
        onConfirm={handleConfirmDelete}
        onClose={() => setIsDeleteOpen(false)}
        description={
          <div className="space-y-3 text-left">
            <p className="text-sm text-ink-700 leading-normal">
              Are you sure you want to delete this expense record?
            </p>

            <div className="rounded-xl border border-ink-200/90 bg-ink-50/80 p-3 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-coral-100 text-coral-700">
                <Receipt className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  {row.expense_number} · {categoryName}
                </p>
                <p className="text-sm font-bold text-ink-900 truncate">
                  {formatCurrency(Number(row.amount))}
                  {row.supplier ? ` · ${row.supplier}` : ''}
                </p>
              </div>
            </div>

            <p className="text-xs text-ink-500 leading-relaxed">
              This record will be soft-deleted and removed from active finance registers.
            </p>
          </div>
        }
      />
    </>
  );
}
