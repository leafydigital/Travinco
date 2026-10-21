'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile, assertPageAccess } from '@/lib/supabase/auth-helpers';
import { generalSettingsSchema, bookingSettingsSchema, termsSettingsSchema, faqsSettingsSchema } from '@/lib/validations/settings';
import { revalidatePath } from 'next/cache';

async function upsertSetting(key: string, value: unknown, updatedBy: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('website_settings')
    .upsert({ key, value: value as never, updated_by: updatedBy }, { onConflict: 'key' });
  return error;
}

export async function saveGeneralSettings(raw: unknown) {
  const profile = await requireProfile();
  await assertPageAccess(profile, 'settings', 'edit');

  const parsed = generalSettingsSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const error = await upsertSetting('general', parsed.data, profile.id);
  if (error) return { error: 'Could not save settings.' };

  revalidatePath('/', 'layout');
  revalidatePath('/travinco_dashboard/settings');
  return {};
}

export async function saveBookingSettings(raw: unknown) {
  const profile = await requireProfile();
  await assertPageAccess(profile, 'settings', 'edit');

  const parsed = bookingSettingsSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const error = await upsertSetting('booking', parsed.data, profile.id);
  if (error) return { error: 'Could not save settings.' };

  revalidatePath('/travinco_dashboard/settings');
  return {};
}

export async function saveTermsSettings(raw: unknown) {
  const profile = await requireProfile();
  await assertPageAccess(profile, 'settings', 'edit');

  const parsed = termsSettingsSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const error = await upsertSetting('terms', parsed.data, profile.id);
  if (error) return { error: 'Could not save settings.' };

  revalidatePath('/travinco_dashboard/settings');
  revalidatePath('/packages', 'layout');
  return {};
}

export async function saveFaqsSettings(raw: unknown) {
  const profile = await requireProfile();
  await assertPageAccess(profile, 'settings', 'edit');

  const parsed = faqsSettingsSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const error = await upsertSetting('faqs', parsed.data, profile.id);
  if (error) return { error: 'Could not save settings.' };

  revalidatePath('/travinco_dashboard/settings');
  revalidatePath('/packages', 'layout');
  return {};
}

/**
 * Save the admin notification email in website_settings under 'admin_notification_email'.
 */
export async function saveNotificationEmailAction(newEmail: string): Promise<{ success: boolean; error?: string; email?: string }> {
  try {
    const profile = await requireProfile();
    await assertPageAccess(profile, 'settings', 'edit');

    const trimmed = (newEmail || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    const error = await upsertSetting('admin_notification_email', { email: trimmed }, profile.id);
    if (error) {
      return { success: false, error: 'Could not save notification email.' };
    }

    revalidatePath('/travinco_dashboard/settings');
    return { success: true, email: trimmed };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update notification email.' };
  }
}

/**
 * Send a test email to verify delivery of admin alerts.
 */
export async function sendTestNotificationEmailAction(targetEmail?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const profile = await requireProfile();
    await assertPageAccess(profile, 'settings', 'view');

    const { getAdminNotificationEmail } = await import('@/lib/email/notify');
    const { sendGmail, isGmailConfigured } = await import('@/lib/email/gmail');

    const to = targetEmail?.trim() || (await getAdminNotificationEmail());
    if (!isGmailConfigured()) {
      return { success: false, error: 'Gmail SMTP credentials are not configured on the server.' };
    }

    const subject = 'Travinco Notification System Test';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #0f172a; margin-top: 0;">Travinco Notification Test Successful</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          This test email confirms that your admin notification email address is properly configured and receiving alerts.
        </p>
        <div style="background: #f1f5f9; padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #334155; margin: 16px 0;">
          <strong>Recipient:</strong> ${to}<br/>
          <strong>Timestamp:</strong> ${new Date().toLocaleString()}<br/>
          <strong>Triggered by:</strong> ${profile.full_name || profile.email}
        </div>
        <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">
          All customer booking requests and contact messages will be dispatched to this address immediately upon submission.
        </p>
      </div>
    `;

    const result = await sendGmail({ to, subject, html });
    if (result.error) {
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to send test email.' };
  }
}