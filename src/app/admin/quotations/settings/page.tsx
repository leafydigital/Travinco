import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireProfile, assertRole } from '@/lib/supabase/auth-helpers';
import { loadTourMasters } from '@/lib/tour/data';
import { SettingsClient, TemplatesClient, RebuildDates } from './settings-client';

export const metadata: Metadata = { title: 'Quotation settings — Admin Portal' };

export default async function QuotationSettingsPage() {
  const profile = await requireProfile();
  assertRole(profile, ['admin', 'super_admin']);
  const m = await loadTourMasters({ activeOnly: false });
  const name = (id: number) => m.locations.find((l) => l.id === id)?.display_name || m.locations.find((l) => l.id === id)?.name || '?';
  const templates = m.templates.map((t) => ({
    id: t.id,
    name: t.name,
    is_active: t.is_active,
    nights: t.stays.reduce((a, s) => a + s.nights, 0),
    route: t.stays.map((s) => `${name(s.location_id)} ${s.nights}N`).join(' → '),
  }));

  return (
    <div className="space-y-5 pb-16">
      <div>
        <Link href="/admin/quotations" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Quotations
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-ink-900">Quotation &amp; invoice settings</h1>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <SettingsClient settings={m.settings} />
        <div className="space-y-5">
          <TemplatesClient templates={templates} />
          <RebuildDates />
        </div>
      </div>
    </div>
  );
}
