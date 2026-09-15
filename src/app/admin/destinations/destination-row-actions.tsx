'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { setDestinationStatus, deleteDestination } from './actions';
import type { ContentStatus } from '@/types/database';

export function DestinationRowActions({ id, status }: { id: string; status: ContentStatus }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setStatus(s: ContentStatus) {
    startTransition(async () => {
      const result = await setDestinationStatus(id, s);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  }

  function remove() {
    if (!confirm('Delete this destination?')) return;
    startTransition(async () => {
      const result = await deleteDestination(id);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex justify-end gap-1.5 text-xs">
      {status !== 'published' && (
        <button onClick={() => setStatus('published')} disabled={isPending} className="text-brand-600 hover:underline">
          Publish
        </button>
      )}
      {status === 'published' && (
        <button onClick={() => setStatus('draft')} disabled={isPending} className="text-ink-500 hover:underline">
          Unpublish
        </button>
      )}
      <button onClick={remove} disabled={isPending} className="text-red-600 hover:underline">
        Delete
      </button>
    </div>
  );
}
