import { createClient } from '@/lib/supabase/server';
import {
  type PageTitlesContent,
  DEFAULT_PAGE_TITLES_CONTENT,
} from './page-titles-content-types';

export * from './page-titles-content-types';

/**
 * Retrieves the customer page titles and favicon configuration.
 * Prioritizes Supabase `website_settings` (key 'page_titles_content'),
 * gracefully falls back to local JSON backup if Supabase has connection hiccups,
 * and ultimately defaults to factory defaults.
 */
export async function getPageTitlesContent(): Promise<PageTitlesContent> {
  let data: Partial<PageTitlesContent> | null = null;

  try {
    const supabase = await createClient();
    const { data: settingsRow } = await supabase
      .from('website_settings')
      .select('value')
      .eq('key', 'page_titles_content')
      .maybeSingle();

    data = settingsRow?.value as Partial<PageTitlesContent> | null;
  } catch (err) {
    // Supabase connection reset or temporary network glitch, fallback gracefully
  }

  if (!data) {
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const filePath = path.join(
        process.cwd(),
        'src',
        'data',
        'page-titles-content.json'
      );
      const fileContent = await fs.readFile(filePath, 'utf8');
      data = JSON.parse(fileContent);
    } catch {
      // No local backup yet
    }
  }

  return {
    favicon_url: data?.favicon_url || DEFAULT_PAGE_TITLES_CONTENT.favicon_url,
    titles: {
      ...DEFAULT_PAGE_TITLES_CONTENT.titles,
      ...(data?.titles || {}),
    },
  };
}
