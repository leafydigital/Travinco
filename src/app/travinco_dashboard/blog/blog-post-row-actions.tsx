'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Pencil, Trash2, Eye, EyeOff, BookOpen } from 'lucide-react';
import { setBlogPostStatus, deleteBlogPost } from './actions';
import { ConfirmDeleteDialog } from '@/components/admin/confirm-delete-dialog';
import type { ContentStatus } from '@/types/database';

interface ActionButtonProps {
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  className: string;
  icon: React.ReactNode;
}

function ActionButton({
  label,
  onClick,
  href,
  disabled,
  className,
  icon,
}: ActionButtonProps) {
  const shared = `inline-flex items-center justify-center rounded-lg p-1.5 transition-colors disabled:opacity-40 cursor-pointer ${className}`;

  if (href) {
    return (
      <Link href={href} className={shared} aria-label={label} title={label}>
        {icon}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={shared}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}

export function BlogPostRowActions({
  id,
  title,
  status,
  isAdmin = true,
}: {
  id: string;
  title: string;
  status: ContentStatus;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  function handleSetStatus(newStatus: ContentStatus) {
    startTransition(async () => {
      const result = await setBlogPostStatus(id, newStatus);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(newStatus === 'published' ? 'Post published' : 'Post moved to drafts');
        router.refresh();
      }
    });
  }

  function handleConfirmDelete() {
    startTransition(async () => {
      const result = await deleteBlogPost(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Blog post deleted successfully');
        setIsDeleteOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        {/* 1. Edit Action */}
        <ActionButton
          label="Edit post"
          href={`/travinco_dashboard/blog/${id}`}
          icon={<Pencil className="h-4 w-4" />}
          className="text-ink-500 hover:bg-ink-100 hover:text-ink-900"
        />

        {/* 2. Publish / Unpublish Toggle Action */}
        {status !== 'published' ? (
          <ActionButton
            label="Publish post"
            onClick={() => handleSetStatus('published')}
            disabled={isPending}
            icon={<Eye className="h-4 w-4" />}
            className="text-brand-600 hover:bg-brand-50"
          />
        ) : (
          <ActionButton
            label="Unpublish (Draft)"
            onClick={() => handleSetStatus('draft')}
            disabled={isPending}
            icon={<EyeOff className="h-4 w-4" />}
            className="text-amber-600 hover:bg-amber-50"
          />
        )}

        {/* 3. Delete Action with Modal Confirmation */}
        {isAdmin && (
          <ActionButton
            label="Delete post"
            onClick={() => setIsDeleteOpen(true)}
            disabled={isPending}
            icon={<Trash2 className="h-4 w-4" />}
            className="text-coral-600 hover:bg-coral-50 hover:text-coral-700"
          />
        )}
      </div>

      {/* Delete Confirmation Popup Modal */}
      <ConfirmDeleteDialog
        isOpen={isDeleteOpen}
        isPending={isPending}
        title="Delete Blog Post"
        confirmLabel="Delete Post"
        onConfirm={handleConfirmDelete}
        onClose={() => setIsDeleteOpen(false)}
        description={
          <div className="space-y-3 text-left">
            <p className="text-sm text-ink-700 leading-normal">
              Are you sure you want to delete this blog post? It will be removed from your website and dashboard.
            </p>

            <div className="rounded-xl border border-ink-200/90 bg-ink-50/80 p-3 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-coral-100 text-coral-700">
                <BookOpen className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Target Blog Post</p>
                <p className="text-sm font-bold text-ink-900 truncate" title={title}>
                  {title}
                </p>
              </div>
            </div>

            <p className="text-xs text-ink-500 leading-relaxed">
              This action soft-deletes the article so visitors will no longer be able to read it.
            </p>
          </div>
        }
      />
    </>
  );
}

export function DeleteBlogPostButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);

  function handleConfirmDelete() {
    startTransition(async () => {
      const result = await deleteBlogPost(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Blog post deleted successfully');
        setIsOpen(false);
        router.push('/travinco_dashboard/blog');
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-coral-200 bg-coral-50/60 px-3 py-1.5 text-xs font-medium text-coral-700 hover:bg-coral-100 transition-colors cursor-pointer disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span>Delete post</span>
      </button>

      <ConfirmDeleteDialog
        isOpen={isOpen}
        isPending={isPending}
        title="Delete Blog Post"
        confirmLabel="Delete Post"
        onConfirm={handleConfirmDelete}
        onClose={() => setIsOpen(false)}
        description={
          <div className="space-y-3 text-left">
            <p className="text-sm text-ink-700 leading-normal">
              Are you sure you want to delete this blog post? It will be removed from your website and dashboard.
            </p>

            <div className="rounded-xl border border-ink-200/90 bg-ink-50/80 p-3 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-coral-100 text-coral-700">
                <BookOpen className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Target Blog Post</p>
                <p className="text-sm font-bold text-ink-900 truncate" title={title}>
                  {title}
                </p>
              </div>
            </div>

            <p className="text-xs text-ink-500 leading-relaxed">
              This action soft-deletes the article so visitors will no longer be able to read it.
            </p>
          </div>
        }
      />
    </>
  );
}
