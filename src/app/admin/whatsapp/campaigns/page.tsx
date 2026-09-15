import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate } from '@/lib/utils/format';
import Link from 'next/link';
import { CampaignCreateForm } from './campaign-create-form';
import { isUsingMockProvider } from '@/lib/whatsapp/provider';

export default async function WhatsappCampaignsPage() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: campaigns }, { data: templates }] = await Promise.all([
    supabase
      .from('whatsapp_campaigns')
      .select('*, whatsapp_templates(name)')
      .order('created_at', { ascending: false }),
    supabase.from('whatsapp_templates').select('id, name').order('name'),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink-900">WhatsApp campaigns</h1>
        <nav className="flex gap-2 text-sm">
          <Link href="/admin/whatsapp" className="btn-outline">
            Contacts
          </Link>
          <Link href="/admin/whatsapp/templates" className="btn-outline">
            Templates
          </Link>
          <Link
            href="/admin/whatsapp/campaigns"
            className="btn-outline bg-brand-50 border-brand-300 text-brand-700"
          >
            Campaigns
          </Link>
        </nav>
      </div>

      {isUsingMockProvider() && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Running in mock mode — campaigns are fully functional but no real WhatsApp messages are
          sent. Set WHATSAPP_PROVIDER and credentials in .env.local to connect a real official
          provider.
        </p>
      )}

      <CampaignCreateForm templates={templates ?? []} />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Template</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Sent / Failed</th>
                <th className="px-5 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {(campaigns ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-ink-400">
                    No campaigns yet.
                  </td>
                </tr>
              )}
              {(campaigns ?? []).map((c) => (
                <tr key={c.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/whatsapp/campaigns/${c.id}`}
                      className="font-medium text-ink-800 hover:text-brand-700"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-ink-500">
                    {(() => {
                      const tpl = c.whatsapp_templates as { name: string } | { name: string }[] | null;
                      return (Array.isArray(tpl) ? tpl[0]?.name : tpl?.name) ?? '—';
                    })()}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-5 py-3 text-ink-600">
                    {c.sent_count} / {c.failed_count}
                  </td>
                  <td className="px-5 py-3 text-ink-500">{formatDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
