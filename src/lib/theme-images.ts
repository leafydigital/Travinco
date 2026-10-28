import type { SupabaseClient } from '@supabase/supabase-js';

export type ThemeImageItem = {
  id: string;
  page: string; // 'home' | 'about' | 'gallery' | 'common'
  placement: string; // 'hero' | 'banner' | 'story' | 'showcase' | 'background'
  image_url: string;
  title: string | null;
  subtitle: string | null;
  badge: string | null;
  button_text: string | null;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Fetch all theme images (with fallback to website_settings if the table doesn't exist yet).
 * Client is injected so the dashboard can use the staff session and the public
 * website can use the cached cookie-free client.
 */
export async function fetchThemeImages(
  supabase: SupabaseClient<any, any, any>
): Promise<{ data: ThemeImageItem[]; error?: string }> {
  try {
    // Query deleted tombstones from website_settings
    const { data: deletedMarkers } = await supabase
      .from('website_settings')
      .select('key')
      .like('key', 'deleted_theme_img_%');

    const deletedIds = new Set(
      (deletedMarkers || []).map((m: { key: string }) => m.key.replace('deleted_theme_img_', ''))
    );

    // 1. Try querying theme_images table
    const { data: dbData, error: dbError } = await supabase
      .from('theme_images')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (!dbError && dbData) {
      const activeItems = (dbData as ThemeImageItem[]).filter(
        (img) => !img.is_deleted && !deletedIds.has(img.id)
      );
      return { data: activeItems };
    }

    // 2. Fallback to website_settings if table not created yet in Supabase studio
    const { data: settingsData } = await supabase
      .from('website_settings')
      .select('key, value')
      .like('key', 'theme_img_%');

    const fallbackItems: ThemeImageItem[] = (settingsData ?? [])
      .map((s: { value: unknown }) => s.value as ThemeImageItem)
      .filter((item) => item && !item.is_deleted && !deletedIds.has(item.id))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    return { data: fallbackItems };
  } catch (err: any) {
    console.error('Error fetching theme images:', err);
    return { data: [], error: 'Could not load theme images.' };
  }
}
