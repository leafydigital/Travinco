'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Rocket } from 'lucide-react';
import { publishPackage } from '../actions';

export function PublishFromPreviewButton({ packageId }: { packageId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handlePublish() {
    startTransition(async () => {
      const result = await publishPackage(packageId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Package published — it\u2019s live on the site now.');
      router.refresh();
    });
  }

  return (
    <button type="button" onClick={handlePublish} disabled={isPending} className="btn-cta">
      <Rocket className="h-4 w-4" /> {isPending ? 'Publishing…' : 'Publish'}
    </button>
  );
}
