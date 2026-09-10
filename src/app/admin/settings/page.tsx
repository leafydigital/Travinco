import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { redirect } from 'next/navigation';
import { GeneralSettingsForm } from './general-settings-form';
import { BookingSettingsForm } from './booking-settings-form';
import { ExpenseCategoryManager } from './expense-category-manager';
import type { GeneralSettingsFormValues, BookingSettingsFormValues } from '@/lib/validations/settings';

export default async function AdminSettingsPage() {
  const profile = await requireProfile();
  if (!['admin', 'super_admin'].includes(profile.role)) {
    redirect('/admin?error=forbidden');
  }

  const supabase = await createClient();
  const [{ data: generalRow }, { data: bookingRow }, { data: categories }] = await Promise.all([
    supabase.from('website_settings').select('value').eq('key', 'general').maybeSingle(),
    supabase.from('website_settings').select('value').eq('key', 'booking').maybeSingle(),
    supabase.from('expense_categories').select('*').order('sort_order'),
  ]);

  return (
    <div className="max-w-3xl space-y-8 pb-16">
      <h1 className="text-xl font-semibold text-ink-900">Settings</h1>

      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink-800">General & contact</h2>
        <GeneralSettingsForm initialValues={(generalRow?.value as GeneralSettingsFormValues) ?? {}} />
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink-800">Booking defaults</h2>
        <BookingSettingsForm initialValues={(bookingRow?.value as BookingSettingsFormValues) ?? {}} />
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink-800">Finance — expense categories</h2>
        <ExpenseCategoryManager categories={categories ?? []} />
      </div>

      <div className="card p-5">
        <h2 className="mb-2 text-sm font-semibold text-ink-800">WhatsApp provider</h2>
        <p className="text-sm text-ink-500">
          WhatsApp Business API credentials are configured via environment variables (
          <code className="rounded bg-ink-100 px-1 py-0.5 text-xs">WHATSAPP_API_URL</code>,{' '}
          <code className="rounded bg-ink-100 px-1 py-0.5 text-xs">WHATSAPP_API_TOKEN</code>), never
          through this UI — secrets are never stored in the database or shown after saving. See{' '}
          <code className="rounded bg-ink-100 px-1 py-0.5 text-xs">.env.example</code> and the README
          for setup. The system runs in mock mode until those are set.
        </p>
      </div>
    </div>
  );
}
