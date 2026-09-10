'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { setEventStatus, deleteEvent } from '../content-actions';
import type { ContentStatus } from '@/types/database';

export function EventRowActions({ id, status }: { id: string; status: ContentStatus }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setStatus(s: ContentStatus) {
    startTransition(async () => {
      const result = await setEventStatus(id, s);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  }

  function remove() {
    if (!confirm('Delete this event?')) return;
    startTransition(async () => {
      const result = await deleteEvent(id);
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
      {status !== 'archived' && (
        <button onClick={() => setStatus('archived')} disabled={isPending} className="text-ink-500 hover:underline">
          Archive
        </button>
      )}
      <button onClick={remove} disabled={isPending} className="text-red-600 hover:underline">
        Delete
      </button>
    </div>
  );
}
