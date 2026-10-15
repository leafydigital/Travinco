'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

export function DeleteFinanceRowButton({
  id,
  action,
}: {
  id: string;
  action: (id: string) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    startTransition(async () => {
      const result = await action(id);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
      aria-label="Delete entry"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
