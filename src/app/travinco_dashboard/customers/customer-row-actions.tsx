'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, Pencil, Trash2, Power, PowerOff, Loader2 } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/admin/confirm-delete-dialog';
import { CustomerEditModal } from './customer-edit-modal';
import { deleteCustomer, toggleCustomerStatus } from './actions';

interface CustomerRowActionsProps {
  customer: {
    id: string;
    full_name: string;
    phone?: string | null;
    whatsapp_number?: string | null;
    email?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    source?: string | null;
    notes?: string | null;
    is_active?: boolean | null;
  };
  isActive?: boolean;
  canEdit: boolean;
  isAdmin: boolean;
}

export function CustomerRowActions({
  customer,
  isActive = true,
  canEdit,
  isAdmin,
}: CustomerRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isToggling, setIsToggling] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  function handleToggleActive() {
    setIsToggling(true);
    startTransition(async () => {
      try {
        const nextState = !isActive;
        const res = await toggleCustomerStatus(customer.id, nextState);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(`Customer ${customer.full_name} ${nextState ? 'activated' : 'deactivated'}`);
          router.refresh();
        }
      } finally {
        setIsToggling(false);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteCustomer(customer.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Customer deleted successfully');
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        {/* Enable / Disable Toggle Switch */}
        {canEdit && (
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={handleToggleActive}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 cursor-pointer select-none group mr-1 disabled:opacity-50 disabled:cursor-not-allowed"
            title={isActive ? 'Enabled — click to disable' : 'Disabled — click to enable'}
          >
            <span
              className={`text-[11px] font-medium transition-colors hidden sm:inline ${
                isActive ? 'text-emerald-700 font-semibold' : 'text-ink-400'
              }`}
            >
              {isActive ? 'Enabled' : 'Disabled'}
            </span>
            <div
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out ${
                isActive ? 'bg-emerald-500' : 'bg-ink-300 group-hover:bg-ink-400'
              }`}
            >
              <span
                className={`pointer-events-none inline-flex h-4 w-4 items-center justify-center transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                  isActive ? 'translate-x-[18px]' : 'translate-x-[2px]'
                }`}
              >
                {isPending && isToggling ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin text-ink-500" />
                ) : null}
              </span>
            </div>
          </button>
        )}

        {/* View Action */}
        <Link
          href={`/admin/customers/${customer.id}`}
          className="btn-outline h-7 px-2.5 text-xs text-brand-700 hover:bg-brand-50"
          title="View details"
        >
          <Eye className="h-3.5 w-3.5 sm:mr-1 inline" />
          <span className="hidden sm:inline">View</span>
        </Link>

        {/* Edit Action */}
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            disabled={isPending}
            className="btn-outline h-7 px-2.5 text-xs text-ink-700 hover:bg-ink-100"
            title="Edit customer"
          >
            <Pencil className="h-3.5 w-3.5 sm:mr-1 inline" />
            <span className="hidden sm:inline">Edit</span>
          </button>
        )}

        {/* Delete Action (Soft Delete) */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            disabled={isPending}
            className="btn-ghost h-7 px-2 text-xs text-coral-600 hover:bg-coral-50 hover:text-coral-700 disabled:opacity-50"
            title="Delete customer"
          >
            <Trash2 className="h-3.5 w-3.5 sm:mr-1 inline" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        )}
      </div>

      {/* Edit Customer Modal */}
      {editOpen && (
        <CustomerEditModal
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          customer={customer}
        />
      )}

      {/* Confirm Soft Delete Dialog */}
      <ConfirmDeleteDialog
        isOpen={deleteOpen}
        isPending={isPending}
        title="Delete Customer"
        description={
          <>
            Are you sure you want to delete customer{' '}
            <strong className="text-ink-900">{customer.full_name}</strong>? This
            action will remove them from the active customers list.
          </>
        }
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}
