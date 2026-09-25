'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile, assertRole } from '@/lib/supabase/auth-helpers';
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
  assertRole(profile, ['admin', 'super_admin']);

  const parsed = generalSettingsSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const error = await upsertSetting('general', parsed.data, profile.id);
  if (error) return { error: 'Could not save settings.' };

  revalidatePath('/', 'layout');
  revalidatePath('/admin/settings');
  return {};
}

export async function saveBookingSettings(raw: unknown) {
  const profile = await requireProfile();
  assertRole(profile, ['admin', 'super_admin']);

  const parsed = bookingSettingsSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const error = await upsertSetting('booking', parsed.data, profile.id);
  if (error) return { error: 'Could not save settings.' };

  revalidatePath('/admin/settings');
  return {};
}

export async function saveTermsSettings(raw: unknown) {
  const profile = await requireProfile();
  assertRole(profile, ['admin', 'super_admin']);

  const parsed = termsSettingsSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const error = await upsertSetting('terms', parsed.data, profile.id);
  if (error) return { error: 'Could not save settings.' };

  revalidatePath('/admin/settings');
  revalidatePath('/packages', 'layout');
  return {};
}

export async function saveFaqsSettings(raw: unknown) {
  const profile = await requireProfile();
  assertRole(profile, ['admin', 'super_admin']);

  const parsed = faqsSettingsSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const error = await upsertSetting('faqs', parsed.data, profile.id);
  if (error) return { error: 'Could not save settings.' };

  revalidatePath('/admin/settings');
  revalidatePath('/packages', 'layout');
  return {};
}