import { createClient } from '@/lib/supabase/server';

export type GeneralSettings = {
  business_name?: string;
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
  const supabase = await createClient();
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
