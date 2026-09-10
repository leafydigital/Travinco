'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { deleteWhatsappTemplate } from '../actions';

export function TemplateRowActions({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remove() {
    if (!confirm('Delete this template?')) return;
    startTransition(async () => {
      const result = await deleteWhatsappTemplate(id);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <button onClick={remove} disabled={isPending} className="text-ink-400 hover:text-red-600" aria-label="Delete template">
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
