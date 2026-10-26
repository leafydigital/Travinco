'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Pencil, Eye, EyeOff, CheckCircle2, Ban, Trash2, MapPin } from 'lucide-react';
import { setDestinationStatus, toggleDestinationActive, deleteDestination } from './actions';
import { ConfirmDeleteDialog } from '@/components/admin/confirm-delete-dialog';
import type { ContentStatus } from '@/types/database';

interface DestinationRowActionsProps {
  id: string;
  name: string;
  status: ContentStatus;
  isActive?: boolean;
  isAdmin: boolean;
}

function ActionButton({
  label,
  onClick,
  href,
  disabled,
  className,
  icon,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  className: string;
  icon: React.ReactNode;
}) {
  const shared = `group relative inline-flex items-center justify-center rounded-lg p-1.5 transition-colors disabled:opacity-40 cursor-pointer ${className}`;
  const tooltip = (
    <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-navy-900 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 z-30">
      {label}
    </span>
  );

  if (href) {
    return (
      <Link href={href} prefetch={true} className={shared} aria-label={label}>
        {tooltip}
        {icon}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={shared} aria-label={label}>
      {tooltip}
      {icon}
    </button>
  );
}

export function DestinationRowActions({
  id,
  name,
  status,
  isActive = true,
  isAdmin,
}: DestinationRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Consider active if status is published or isActive flag is true
  const isCurrentlyActive = status === 'published' && isActive !== false;

  function run(action: () => Promise<{ error?: string }>, successMessage: string) {
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(successMessage);
        router.refresh();
      }
    });
  }

  function handleConfirmDelete() {
    startTransition(async () => {
      const result = await deleteDestination(id);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success('Destination moved to trash');
        setIsDeleteOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        {/* 1. Edit Button */}
        <ActionButton
          label="Edit Destination"
          href={`/travinco_dashboard/destinations/${id}`}
          icon={<Pencil className="h-4 w-4" />}
          className="text-ink-500 hover:bg-ink-100 hover:text-ink-900"
        />

        {/* 2. Publish / Unpublish Button */}
        {status === 'published' ? (
          <ActionButton
            label="Unpublish (Draft)"
            onClick={() => run(() => setDestinationStatus(id, 'draft'), 'Destination unpublished')}
            disabled={isPending}
            icon={<EyeOff className="h-4 w-4" />}
            className="text-amber-600 hover:bg-amber-50"
          />
        ) : (
          <ActionButton
            label="Publish Destination"
            onClick={() => run(() => setDestinationStatus(id, 'published'), 'Destination published')}
            disabled={isPending}
            icon={<Eye className="h-4 w-4" />}
            className="text-brand-600 hover:bg-brand-50"
          />
        )}

        {/* 3. Active / Deactivate Toggle Button */}
        {isCurrentlyActive ? (
          <ActionButton
            label="Deactivate (Set Inactive)"
            onClick={() => run(() => toggleDestinationActive(id, true), 'Destination deactivated')}
            disabled={isPending}
            icon={<CheckCircle2 className="h-4 w-4" />}
            className="text-emerald-600 hover:bg-emerald-50"
          />
        ) : (
          <ActionButton
            label="Activate Destination"
            onClick={() => run(() => toggleDestinationActive(id, false), 'Destination activated')}
            disabled={isPending}
            icon={<Ban className="h-4 w-4" />}
            className="text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          />
        )}

        {/* 4. Delete Option (Admin Only) */}
        {isAdmin && (
          <ActionButton
            label="Delete Destination"
            onClick={() => setIsDeleteOpen(true)}
            disabled={isPending}
            icon={<Trash2 className="h-4 w-4" />}
            className="text-coral-600 hover:bg-coral-50"
          />
        )}
      </div>

      {/* Delete Confirmation Popup Modal */}
      <ConfirmDeleteDialog
        isOpen={isDeleteOpen}
        title="Delete Destination"
        description={
          <div className="space-y-3 text-left">
            <p className="text-sm text-ink-700 leading-normal">
              Are you sure you want to delete this destination from active listings?
            </p>

            {/* Target Highlight Box */}
            <div className="rounded-xl border border-ink-200/90 bg-ink-50/80 p-3 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-coral-100 text-coral-700">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Target Destination</p>
                <p className="text-sm font-bold text-ink-900 truncate" title={name}>
                  {name}
                </p>
              </div>
            </div>

            <p className="text-xs text-ink-500 leading-relaxed">
              This destination will be soft-deleted. Existing packages assigned to it will remain preserved in the system.
            </p>
          </div>
        }
        confirmLabel="Delete Destination"
        isPending={isPending}
        onConfirm={handleConfirmDelete}
        onClose={() => setIsDeleteOpen(false)}
      />
    </>
  );
}
