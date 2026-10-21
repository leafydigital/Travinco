import { createClient } from '@/lib/supabase/server';
import { requireProfile, assertPageAccess } from '@/lib/supabase/auth-helpers';
import { getAdminNotificationEmail } from '@/lib/email/notify';
import { GeneralSettingsForm } from './general-settings-form';
import { BookingSettingsForm } from './booking-settings-form';
import { TermsSettingsForm } from './terms-settings-form';
import { NotificationEmailForm } from './notification-email-form';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type {
  GeneralSettingsFormValues,
  BookingSettingsFormValues,
  TermsSettingsFormValues,
} from '@/lib/validations/settings';

export default async function AdminSettingsPage() {
  const profile = await requireProfile();
  await assertPageAccess(profile, 'settings');

  const supabase = await createClient();
  const [{ data: generalRow }, { data: bookingRow }, { data: termsRow }, notificationEmail] =
    await Promise.all([
      supabase.from('website_settings').select('value').eq('key', 'general').maybeSingle(),
      supabase.from('website_settings').select('value').eq('key', 'booking').maybeSingle(),
      supabase.from('website_settings').select('value').eq('key', 'terms').maybeSingle(),
      getAdminNotificationEmail(),
    ]);

  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';

  return (
    <div className="max-w-3xl space-y-6 pb-16">
      <div>
        <Link
          href="/travinco_dashboard"
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-brand-700 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to dashboard</span>
        </Link>
        <h1 className="text-xl font-semibold text-ink-900">Settings</h1>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-ink-800">Admin Notification Email</h2>
            <p className="mt-0.5 text-xs text-ink-500">
              Receives instant email alerts when customers submit Contact requests or Book With Us inquiries.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Alerts
          </span>
        </div>
        <NotificationEmailForm initialEmail={notificationEmail} isAdmin={isAdmin} />
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink-800">General & contact</h2>
        <GeneralSettingsForm initialValues={(generalRow?.value as GeneralSettingsFormValues) ?? {}} />
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink-800">Booking defaults</h2>
        <BookingSettingsForm initialValues={(bookingRow?.value as BookingSettingsFormValues) ?? {}} />
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink-800">Terms & conditions</h2>
        <TermsSettingsForm initialValues={(termsRow?.value as TermsSettingsFormValues) ?? {}} />
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
