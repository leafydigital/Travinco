'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RotateCcw } from 'lucide-react';
import { toast, confirmAlert } from '@/lib/admin-alert';
import { restoreCustomer } from './actions';

/** Brings a deleted customer back to the active list (admins only). */
export function CustomerRestoreButton({ customerId, customerName }: { customerId: string; customerName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleRestore() {
    const ok = await confirmAlert({
      title: `Restore ${customerName}?`,
      text: 'The customer will be active again.',
      confirmText: 'Restore',
      icon: 'question',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await restoreCustomer(customerId);
      if (res.error) return void toast.error(res.error);
      toast.success('Customer restored');
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleRestore}
      disabled={isPending}
      data-no-confirm-save="true"
      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
      title="Restore customer"
    >
      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
      Restore
    </button>
  );
}
