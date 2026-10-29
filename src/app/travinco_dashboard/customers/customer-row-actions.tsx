'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, Trash2 } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/admin/confirm-delete-dialog';
import { CustomerEditModal } from './customer-edit-modal';
import { deleteCustomer, toggleCustomerStatus, type CustomerTableItem } from './actions';

interface CustomerRowActionsProps {
  customer: CustomerTableItem;
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
  const [active, setActive] = useState(isActive);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Sync state if prop changes from parent / server refresh
  useEffect(() => {
    setActive(isActive);
  }, [isActive]);

  // Confirmed server state + in-flight guard: the switch flips instantly, and
  // rapid clicks are coalesced into one follow-up request for the final state.
  const confirmedRef = useRef(isActive);
  const desiredRef = useRef(isActive);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!inFlightRef.current) {
      confirmedRef.current = isActive;
      desiredRef.current = isActive;
    }
  }, [isActive]);

  function broadcast(nextState: boolean) {
    window.dispatchEvent(
      new CustomEvent('travinco:customer-status-changed', {
        detail: { customerId: customer.id, isActive: nextState },
      })
    );
  }

  async function syncStatus() {
    inFlightRef.current = true;
    while (desiredRef.current !== confirmedRef.current) {
      const target = desiredRef.current;
      let failed = false;
      try {
        const res = await toggleCustomerStatus(customer.id, target);
        if (res.error) {
          failed = true;
          toast.error(res.error);
        }
      } catch {
        failed = true;
        toast.error('Could not update customer status.');
      }
      if (failed) {
        desiredRef.current = confirmedRef.current;
        setActive(confirmedRef.current);
        broadcast(confirmedRef.current);
        break;
      }
      confirmedRef.current = target;
    }
    inFlightRef.current = false;
  }

  function handleToggleActive() {
    const nextState = !desiredRef.current;
    desiredRef.current = nextState;
    setActive(nextState);
    // Status badge in the table listens for this and updates in the same frame.
    broadcast(nextState);
    if (!inFlightRef.current) void syncStatus();
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
            aria-checked={active}
            onClick={handleToggleActive}
            className="inline-flex items-center gap-1.5 cursor-pointer select-none group mr-1"
            title={active ? 'Enabled — click to disable' : 'Disabled — click to enable'}
          >
            <span
              className={`text-[11px] font-medium transition-colors hidden sm:inline ${
                active ? 'text-emerald-700 font-semibold' : 'text-ink-400'
              }`}
            >
              {active ? 'Enabled' : 'Disabled'}
            </span>
            <div
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out ${
                active ? 'bg-emerald-500' : 'bg-ink-300 group-hover:bg-ink-400'
              }`}
            >
              <span
                className={`pointer-events-none inline-flex h-4 w-4 items-center justify-center transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                  active ? 'translate-x-[18px]' : 'translate-x-[2px]'
                }`}
              >
              </span>
            </div>
          </button>
        )}

        {/* Edit Action */}
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            disabled={isPending}
            className="btn-outline h-7 px-2.5 text-xs text-ink-700 hover:bg-ink-100 cursor-pointer"
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
            className="btn-ghost h-7 px-2 text-xs text-coral-600 hover:bg-coral-50 hover:text-coral-700 disabled:opacity-50 cursor-pointer"
            title="Delete customer"
          >
            <Trash2 className="h-3.5 w-3.5 sm:mr-1 inline" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        )}
      </div>

      {/* Edit Customer Modal (fetches full customer record on demand) */}
      {editOpen && (
        <CustomerEditModal
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          customerId={customer.id}
          initialName={customer.full_name}
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
