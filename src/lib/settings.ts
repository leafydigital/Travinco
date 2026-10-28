// Public website content: read with the cookie-free anon client so it can be cached
import { createPublicClient } from '@/lib/supabase/public';

export type GeneralSettings = {
  business_name?: string;
  logo_url?: string;
  logo_light_url?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  working_hours?: string;
  social?: { facebook?: string; instagram?: string; twitter?: string };
  map_embed_url?: string;
};

/** Reads a single settings row by key. Returns null if not yet configured
 * (Settings page hasn't been saved) so callers can fall back gracefully. */
export async function getSetting<T = Record<string, unknown>>(key: string): Promise<T | null> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from('website_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  return (data?.value as T) ?? null;
}

export async function getGeneralSettings(): Promise<GeneralSettings> {
  const settings = await getSetting<GeneralSettings>('general');
  return settings ?? {};
}

export type TermsSettings = {
  terms_and_conditions?: string;
};

/** The single, shared terms & conditions text shown on every package's
 * detail page, replacing the old per-package field. */
export async function getTermsSettings(): Promise<TermsSettings> {
  const settings = await getSetting<TermsSettings>('terms');
  return settings ?? {};
}
