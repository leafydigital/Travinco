'use client';

import { useTransition } from 'react';
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
    <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-navy-900 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
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
  status,
  isFeatured,
}: {
  id: string;
  status: string;
  isFeatured: boolean;
}) {
  const [isPending, startTransition] = useTransition();
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

  function handleDelete() {
    if (!confirm('Permanently delete this package? This cannot be undone.')) return;
    run(() => deletePackage(id), 'Package deleted');
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      <ActionButton label="Edit" href={`/admin/packages/${id}`} className="text-ink-500 hover:bg-ink-100 hover:text-ink-800" />
      <ActionButton
        label="Preview"
        href={`/admin/packages/${id}/preview`}
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
      <ActionButton
        label="Delete"
        onClick={handleDelete}
        disabled={isPending}
        className="text-coral-600 hover:bg-coral-50"
      />
    </div>
  );
}
