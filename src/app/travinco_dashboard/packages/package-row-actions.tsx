'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import { Pencil, Eye, CheckCircle2, EyeOff, Star, Copy, Trash2 } from 'lucide-react';
import {
  publishPackage,
  unpublishPackage,
  duplicatePackage,
  deletePackage,
  toggleFeatured,
} from './actions';
import { ConfirmDeleteDialog } from '@/components/admin/confirm-delete-dialog';

function ActionButton({
  label,
  onClick,
  href,
  target,
  disabled,
  className,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  target?: string;
  disabled?: boolean;
  className: string;
}) {
  const shared = `group relative rounded-lg p-1.5 transition-colors disabled:opacity-40 ${className}`;
  const tooltip = (
    <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-navy-900 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 z-30">
      {label}
    </span>
  );

  if (href) {
    return (
      <Link href={href} target={target} className={shared} aria-label={label}>
        {tooltip}
        <ActionIcon label={label} />
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={shared} aria-label={label}>
      {tooltip}
      <ActionIcon label={label} />
    </button>
  );
}

function ActionIcon({ label }: { label: string }) {
  const cls = 'h-4 w-4';
  switch (label) {
    case 'Edit':
      return <Pencil className={cls} />;
    case 'Preview':
      return <Eye className={cls} />;
    case 'Publish':
      return <CheckCircle2 className={cls} />;
    case 'Unpublish':
      return <EyeOff className={cls} />;
    case 'Mark as featured':
    case 'Remove featured':
      return <Star className={cls} />;
    case 'Duplicate':
      return <Copy className={cls} />;
    case 'Delete':
      return <Trash2 className={cls} />;
    default:
      return null;
  }
}

export function PackageRowActions({
  id,
  title,
  status,
  isFeatured,
  isAdmin = false,
}: {
  id: string;
  title: string;
  status: string;
  isFeatured: boolean;
  isAdmin?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const router = useRouter();

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
      const result = await deletePackage(id);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success('Package moved to trash');
        setIsDeleteOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-0.5">
        <ActionButton
          label="Edit"
          href={`/travinco_dashboard/packages/${id}`}
          className="text-ink-500 hover:bg-ink-100 hover:text-ink-800"
        />
        <ActionButton
          label="Preview"
          href={`/travinco_dashboard/packages/${id}/preview`}
          target="_blank"
          className="text-ink-500 hover:bg-ink-100 hover:text-ink-800"
        />
        {status !== 'published' && (
          <ActionButton
            label="Publish"
            onClick={() => run(() => publishPackage(id), 'Package published')}
            disabled={isPending}
            className="text-brand-600 hover:bg-brand-50"
          />
        )}
        {status === 'published' && (
          <ActionButton
            label="Unpublish"
            onClick={() => run(() => unpublishPackage(id), 'Package unpublished')}
            disabled={isPending}
            className="text-ink-500 hover:bg-ink-100 hover:text-ink-800"
          />
        )}
        <ActionButton
          label={isFeatured ? 'Remove featured' : 'Mark as featured'}
          onClick={() =>
            run(
              () => toggleFeatured(id, !isFeatured),
              isFeatured ? 'Removed from featured' : 'Marked as featured'
            )
          }
          disabled={isPending}
          className={isFeatured ? 'text-sand-600 hover:bg-sand-50' : 'text-ink-400 hover:bg-sand-50 hover:text-sand-600'}
        />
        <ActionButton
          label="Duplicate"
          onClick={() => run(() => duplicatePackage(id), 'Package duplicated')}
          disabled={isPending}
          className="text-ink-500 hover:bg-ink-100 hover:text-ink-800"
        />
        {isAdmin && (
          <ActionButton
            label="Delete"
            onClick={() => setIsDeleteOpen(true)}
            disabled={isPending}
            className="text-coral-600 hover:bg-coral-50"
          />
        )}
      </div>

      {/* Delete Confirmation Popup Modal */}
      <ConfirmDeleteDialog
        isOpen={isDeleteOpen}
        title="Delete Travel Package"
        maxWidth="max-w-[420px]"
        description={
          <div className="space-y-3 text-left">
            <p className="text-sm text-ink-700 leading-normal">
              Are you sure you want to delete this travel package from active listings?
            </p>

            {/* Target Package Highlight Box */}
            <div className="rounded-xl border border-ink-200/90 bg-ink-50/80 p-3 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-coral-100 text-coral-700">
                <Trash2 className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Target Package</p>
                <p className="text-sm font-bold text-ink-900 truncate" title={title}>
                  {title}
                </p>
              </div>
            </div>

            <p className="text-xs text-ink-500 leading-relaxed">
              This package will be soft-deleted and removed from public listings and customer views.
            </p>
          </div>
        }
        confirmLabel="Delete Package"
        isPending={isPending}
        onConfirm={handleConfirmDelete}
        onClose={() => setIsDeleteOpen(false)}
      />
    </>
  );
}
