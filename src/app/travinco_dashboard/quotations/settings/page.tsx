import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireProfile, assertRole } from '@/lib/supabase/auth-helpers';
import { loadTourMasters } from '@/lib/tour/data';
import { SettingsClient, RebuildDates } from './settings-client';
import { QuotationLogosEditor } from './quotation-logos-editor';
import {
  InvoiceSettingsProvider,
  InvoiceSettingsEditor,
  BankDetailsLivePreview,
} from './invoice-settings-editor';

export const metadata: Metadata = { title: 'Quotation settings — Admin Portal' };

export default async function QuotationSettingsPage() {
  const profile = await requireProfile();
  assertRole(profile, ['admin', 'super_admin']);
  const m = await loadTourMasters({ activeOnly: false });

  return (
    <div className="space-y-5 pb-16">
      <div>
        <Link
          href="/travinco_dashboard/quotations"
          className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" /> Quotations
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-ink-900">Quotation &amp; invoice settings</h1>
      </div>

      <InvoiceSettingsProvider initialSettings={m.settings.invoice_settings}>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
          {/* Left Column: Settings Editors */}
          <div className="space-y-5 min-w-0">
            <InvoiceSettingsEditor />
            <SettingsClient settings={m.settings} />
            <QuotationLogosEditor initialConfig={m.settings.logos_config} />
          </div>

          {/* Right Column: Bank Details Live Preview & Tools */}
          <div className="space-y-5 min-w-0">
            <div className="xl:sticky xl:top-6 space-y-5">
              <BankDetailsLivePreview />
              <RebuildDates />
            </div>
          </div>
        </div>
      </InvoiceSettingsProvider>
    </div>
  );
}
