'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { sendWhatsappCampaign } from '../../actions';

export function SendCampaignButton({
  campaignId,
  canSend,
}: {
  campaignId: string;
  canSend: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSend() {
    if (!confirm('Send this campaign now to all pending recipients?')) return;
    startTransition(async () => {
      const result = await sendWhatsappCampaign(campaignId);
      if ('error' in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Sent: ${result.sentCount}, failed: ${result.failedCount}`);
      router.refresh();
    });
  }

  return (
    <button onClick={handleSend} disabled={isPending || !canSend} className="btn-primary">
      <Send className="h-4 w-4" />
      {isPending ? 'Sending…' : 'Send campaign'}
    </button>
  );
}
