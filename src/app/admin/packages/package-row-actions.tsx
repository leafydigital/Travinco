'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import { MoreVertical } from 'lucide-react';
import {
  publishPackage,
  unpublishPackage,
  archivePackage,
  duplicatePackage,
  deletePackage,
} from './actions';
import { useState, useRef, useEffect } from 'react';

export function PackageRowActions({ id, status }: { id: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function run(action: () => Promise<{ error?: string }>, successMessage: string) {
    setOpen(false);
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
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 disabled:opacity-50"
        aria-label="Package actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-ink-100 bg-white py-1 shadow-lg">
          <Link
            href={`/admin/packages/${id}`}
            className="block px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-50"
          >
            Edit
          </Link>
          <Link
            href={`/packages/preview/${id}`}
            target="_blank"
            className="block px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-50"
          >
            Preview
          </Link>
          {status !== 'published' && (
            <button
              onClick={() => run(() => publishPackage(id), 'Package published')}
              className="block w-full px-3 py-1.5 text-left text-sm text-brand-700 hover:bg-ink-50"
            >
              Publish
            </button>
          )}
          {status === 'published' && (
            <button
              onClick={() => run(() => unpublishPackage(id), 'Package unpublished')}
              className="block w-full px-3 py-1.5 text-left text-sm text-ink-700 hover:bg-ink-50"
            >
              Unpublish
            </button>
          )}
          {status !== 'archived' && (
            <button
              onClick={() => run(() => archivePackage(id), 'Package archived')}
              className="block w-full px-3 py-1.5 text-left text-sm text-ink-700 hover:bg-ink-50"
            >
              Archive
            </button>
          )}
          <button
            onClick={() => run(() => duplicatePackage(id), 'Package duplicated')}
            className="block w-full px-3 py-1.5 text-left text-sm text-ink-700 hover:bg-ink-50"
          >
            Duplicate
          </button>
          <div className="my-1 border-t border-ink-100" />
          <button
            onClick={handleDelete}
            className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
