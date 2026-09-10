import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { notFound } from 'next/navigation';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDateTime } from '@/lib/utils/format';
import { SendCampaignButton } from './send-campaign-button';
import { isUsingMockProvider } from '@/lib/whatsapp/provider';
import Link from 'next/link';

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: campaign }, { data: recipients }] = await Promise.all([
    supabase
      .from('whatsapp_campaigns')
      .select('*, whatsapp_templates(name, body)')
      .eq('id', params.id)
      .single(),
    supabase
      .from('whatsapp_campaign_recipients')
      .select('*, whatsapp_contacts(display_name, phone)')
      .eq('campaign_id', params.id),
  ]);

  if (!campaign) notFound();

  const template = campaign.whatsapp_templates as { name: string; body: string } | null;
  const canSend = ['draft', 'scheduled'].includes(campaign.status) && (recipients?.length ?? 0) > 0;

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-ink-900">{campaign.name}</h1>
            <StatusBadge status={campaign.status} />
          </div>
          <p className="text-sm text-ink-500">
            {recipients?.length ?? 0} recipients · Sent {campaign.sent_count}, failed{' '}
            {campaign.failed_count}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isUsingMockProvider() ? (
            <span className="text-xs text-amber-700">Mock mode — no real messages sent</span>
          ) : null}
          <SendCampaignButton campaignId={campaign.id} canSend={canSend} />
          <Link href="/admin/whatsapp/campaigns" className="btn-outline">
            Back
          </Link>
        </div>
      </div>

      {template && (
        <div className="card p-5">
          <h2 className="mb-2 text-sm font-semibold text-ink-800">Message ({template.name})</h2>
          <p className="whitespace-pre-line rounded-lg bg-ink-50 p-3 text-sm text-ink-600">
            {template.body}
          </p>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="border-b border-ink-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-ink-800">Recipients</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Sent at</th>
                <th className="px-5 py-3">Failure reason</th>
              </tr>
            </thead>
            <tbody>
              {(recipients ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-ink-400">
                    No recipients — every current WhatsApp contact may already have opted out, or
                    none matched the audience filter.
                  </td>
                </tr>
              )}
              {(recipients ?? []).map((r) => {
                const contact = r.whatsapp_contacts as {
                  display_name: string | null;
                  phone: string;
                } | null;
                return (
                  <tr key={r.id} className="border-b border-ink-50 last:border-0">
                    <td className="px-5 py-3">
                      <p className="text-ink-700">{contact?.display_name ?? '—'}</p>
                      <p className="text-xs text-ink-400">{contact?.phone}</p>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={r.delivery_status} />
                    </td>
                    <td className="px-5 py-3 text-ink-500">{formatDateTime(r.sent_at)}</td>
                    <td className="px-5 py-3 text-xs text-red-600">{r.failure_reason ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
