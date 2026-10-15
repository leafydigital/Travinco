'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Pencil, Trash2 } from 'lucide-react';
import { deleteEnquiry } from './actions';

export function EnquiryRowActions({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remove() {
    if (!confirm('Delete this enquiry? This cannot be undone.')) return;
    startTransition(async () => {
      const result = await deleteEnquiry(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Enquiry deleted');
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/admin/enquiries/${id}`}
        className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
        aria-label="Edit enquiry"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Link>
      <button
        type="button"
        onClick={remove}
        disabled={isPending}
        className="rounded-lg p-1.5 text-coral-600 hover:bg-coral-50 disabled:opacity-50"
        aria-label="Delete enquiry"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
