import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import Link from 'next/link';
import { TemplateAddForm } from './template-add-form';
import { TemplateRowActions } from './template-row-actions';

export default async function WhatsappTemplatesPage() {
  await requireProfile();
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink-900">WhatsApp templates</h1>
        <nav className="flex gap-2 text-sm">
          <Link href="/admin/whatsapp" className="btn-outline">
            Contacts
          </Link>
          <Link
            href="/admin/whatsapp/templates"
            className="btn-outline bg-brand-50 border-brand-300 text-brand-700"
          >
            Templates
          </Link>
          <Link href="/admin/whatsapp/campaigns" className="btn-outline">
            Campaigns
          </Link>
        </nav>
      </div>

      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Templates sent through a real WhatsApp Business API provider must be pre-approved by Meta
        before use. Create the template here to plan your campaigns, then submit the same content
        for approval in your provider&apos;s dashboard and paste the approved template name in
        (future) provider settings.
      </p>

      <TemplateAddForm />

      <div className="grid gap-4 sm:grid-cols-2">
        {(templates ?? []).length === 0 && <p className="text-sm text-ink-400">No templates yet.</p>}
        {(templates ?? []).map((t) => (
          <div key={t.id} className="card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-ink-800">{t.name}</p>
                <span className="badge mt-1 bg-ink-100 text-ink-600 capitalize">{t.category}</span>
              </div>
              <TemplateRowActions id={t.id} />
            </div>
            <p className="mt-3 whitespace-pre-line rounded-lg bg-ink-50 p-3 text-sm text-ink-600">
              {t.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
