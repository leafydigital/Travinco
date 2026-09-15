'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { setWhatsappOptIn, deleteWhatsappContact } from './actions';

export function ContactRowActions({ id, optIn }: { id: string; optIn: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await setWhatsappOptIn(id, !optIn);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  }

  function remove() {
    if (!confirm('Delete this WhatsApp contact?')) return;
    startTransition(async () => {
      const result = await deleteWhatsappContact(id);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex justify-end gap-2 text-xs">
      <button onClick={toggle} disabled={isPending} className="text-brand-600 hover:underline">
        {optIn ? 'Opt out' : 'Opt in'}
      </button>
      <button onClick={remove} disabled={isPending} className="text-red-600 hover:underline">
        Delete
      </button>
    </div>
  );
}
