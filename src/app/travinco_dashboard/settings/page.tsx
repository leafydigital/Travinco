import type { Metadata } from 'next';
import { requireProfile, assertRole } from '@/lib/supabase/auth-helpers';
import { loadTourMasters } from '@/lib/tour/data';
import { SettingsClient, RebuildDates } from './settings-client';
import { QuotationLogosEditor } from './quotation-logos-editor';
import { SettingsSaveProvider } from './settings-save-bar';
import {
  InvoiceSettingsProvider,
  InvoiceSettingsEditor,
  BankDetailsLivePreview,
} from './invoice-settings-editor';

export const metadata: Metadata = { title: 'Settings — Admin Portal' };

export default async function SettingsPage() {
  const profile = await requireProfile();
  assertRole(profile, ['admin', 'super_admin']);
  const m = await loadTourMasters({ activeOnly: false });

  return (
    <div className="pb-16">
      {/* Sticky header with the single "Save settings" button for every section below */}
      <SettingsSaveProvider title="Settings" subtitle="Quotation & invoice details, bank account, QR code and logos">
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
              <div className="xl:sticky xl:top-28 space-y-5">
                <BankDetailsLivePreview />
                <RebuildDates />
              </div>
            </div>
          </div>
        </InvoiceSettingsProvider>
      </SettingsSaveProvider>
    </div>
  );
}
