'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RefreshCw, Trash2 } from 'lucide-react';
import { saveTourSettings, deleteQuotationTemplate, toggleQuotationTemplate, rebuildRateDateWindows } from '@/lib/tour/master-actions';
import type { TourSettings } from '@/lib/tour/types';

const NUMS: [keyof TourSettings, string, string][] = [
  ['markup_pct', 'Standard markup %', 'Staff quotes always use this'],
  ['gst_pct', 'GST on package %', 'Tour operator GST'],
  ['round_to', 'Round totals to (₹)', 'e.g. 100'],
  ['quote_valid_days', 'Quotation valid for (days)', ''],
  ['sightseeing_km_per_day', 'Local running per night (km)', 'Added to vehicle km estimate'],
  ['invoice_due_days', 'Invoice due after (days)', '0 = due on the travel start date'],
];
const TEXTS: [keyof TourSettings, string][] = [
  ['company_name', 'Company name'],
  ['company_phone', 'Phone'],
  ['company_email', 'Email'],
  ['company_website', 'Website'],
  ['company_gstin', 'GSTIN'],
  ['company_state', 'State (place of supply)'],
  ['sac_code', 'SAC code for invoices'],
];

export function SettingsClient({ settings }: { settings: TourSettings }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    start(async () => {
      const r = await saveTourSettings(data);
      if (r.error) return void toast.error(r.error);
      toast.success('Settings saved');
      router.refresh();
    });
  };
  const val = (k: keyof TourSettings) => (settings[k] == null ? '' : String(settings[k]));

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="card p-5">
        <h2 className="mb-4 font-semibold text-ink-900">Pricing</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {NUMS.map(([k, label, hint]) => (
            <div key={k}>
              <label className="label" htmlFor={`s-${k}`}>{label}</label>
              <input id={`s-${k}`} name={k} type="number" step="any" min={0} required defaultValue={val(k)} className="input" />
              {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
            </div>
          ))}
        </div>
        <p className="mt-3 rounded-lg bg-sand-50 px-3 py-2 text-xs text-sand-900">
          GST is added on top of hotel + vehicle + markup. Some Rate Master rates already include hotel GST – check the hotel&apos;s &quot;GST on rates&quot; field before quoting.
        </p>
      </div>

      <div className="card p-5">
        <h2 className="mb-4 font-semibold text-ink-900">Company details (quotation &amp; invoice header)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {TEXTS.map(([k, label]) => (
            <div key={k}>
              <label className="label" htmlFor={`s-${k}`}>{label}</label>
              <input id={`s-${k}`} name={k} defaultValue={val(k)} className="input" />
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className="label" htmlFor="s-addr">Address</label>
            <textarea id="s-addr" name="company_address" rows={2} defaultValue={val('company_address')} className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="s-bank">Bank details (printed on invoices)</label>
            <textarea id="s-bank" name="bank_details" rows={3} defaultValue={val('bank_details')} className="input" placeholder={'A/c name: …\nA/c no: …\nIFSC: …\nUPI: …'} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="s-terms">Invoice terms</label>
            <textarea id="s-terms" name="invoice_terms" rows={3} defaultValue={val('invoice_terms')} className="input" />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-1 font-semibold text-ink-900">Quotation terms</h2>
        <p className="mb-4 text-xs text-ink-500">One item per line.</p>
        <div className="grid gap-4">
          <div>
            <label className="label" htmlFor="s-ex">Exclusions</label>
            <textarea id="s-ex" name="exclusions" rows={6} defaultValue={settings.exclusions.join('\n')} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="s-can">Cancellation policy — “timeline | charge” per line</label>
            <textarea id="s-can" name="cancellation" rows={5} defaultValue={settings.cancellation.map((c) => c.join(' | ')).join('\n')} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="s-notes">Important notes</label>
            <textarea id="s-notes" name="important_notes" rows={6} defaultValue={settings.important_notes.join('\n')} className="input" />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save settings'}</button>
      </div>
    </form>
  );
}

export function TemplatesClient({ templates }: { templates: { id: number; name: string; is_active: boolean; nights: number; route: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string } | undefined>) =>
    start(async () => {
      const r = await fn();
      if (r?.error) return void toast.error(r.error);
      router.refresh();
    });
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-ink-100 px-5 py-4">
        <h2 className="font-semibold text-ink-900">Package templates</h2>
        <p className="text-xs text-ink-500">Shown under “Start from a package” in the quotation builder. Save new ones from the builder.</p>
      </div>
      <ul>
        {templates.map((t) => (
          <li key={t.id} className="flex items-center gap-3 border-b border-ink-50 px-5 py-2.5 text-sm last:border-0">
            <label className="flex flex-1 items-center gap-3">
              <input type="checkbox" checked={t.is_active} disabled={pending} onChange={(e) => run(() => toggleQuotationTemplate(t.id, e.target.checked))} className="rounded border-ink-300 text-brand-700" />
              <span>
                <b className={t.is_active ? 'text-ink-800' : 'text-ink-400'}>{t.name}</b>
                <span className="block text-xs text-ink-400">{t.nights}N · {t.route}</span>
              </span>
            </label>
            <button
              type="button"
              className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
              title="Delete template"
              onClick={() => window.confirm(`Delete template "${t.name}"?`) && run(() => deleteQuotationTemplate(t.id))}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
        {templates.length === 0 && <li className="px-5 py-6 text-center text-sm text-ink-400">No templates yet.</li>}
      </ul>
    </div>
  );
}

export function RebuildDates() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  return (
    <div className="card p-5">
      <h2 className="font-semibold text-ink-900">Rate Master date windows</h2>
      <p className="mt-1 text-sm text-ink-500">
        Re-reads every active rate&apos;s “Date Range” text and rewrites its season dates. Run this once after upgrading – earlier uploads stored a whole-year window for labels such as “Oct 2026 – Jan 2027” or “Mar &amp; Jun – Sep 2026”. Quotations already read the label directly, so this keeps the database in step.
      </p>
      <button
        type="button"
        className="btn-outline mt-3"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await rebuildRateDateWindows();
            if (r.error) return void toast.error(r.error);
            setResult(`${r.periods} rate periods updated.${r.unreadable?.length ? ` Could not read: ${r.unreadable.join('; ')}` : ''}`);
            toast.success('Date windows rebuilt');
          })
        }
      >
        <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} /> Rebuild date windows
      </button>
      {result && <p className="mt-2 text-xs text-ink-500">{result}</p>}
    </div>
  );
}
