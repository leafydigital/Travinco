import { getSetting } from './settings';
import {
  type PackagesPageContent,
  DEFAULT_PACKAGES_PAGE_CONTENT,
} from './packages-page-content-types';

export * from './packages-page-content-types';

/**
 * Retrieves the package page content configuration from website_settings or local fallback.
 * Merges with default configuration for complete resilience.
 * For server components and server actions only.
 */
export async function getPackagesPageContent(): Promise<PackagesPageContent> {
  try {
    let data = await getSetting<Partial<PackagesPageContent>>('packages_page_content');
    if (!data) {
      try {
        const fs = await import('node:fs/promises');
        const path = await import('node:path');
        const filePath = path.join(process.cwd(), 'src', 'data', 'packages-page-content.json');
        const raw = await fs.readFile(filePath, 'utf8');
        data = JSON.parse(raw);
      } catch {
        // No local backup file yet
      }
    }

    if (!data) return DEFAULT_PACKAGES_PAGE_CONTENT;

    return {
      hero: {
        background_image_url:
          data.hero?.background_image_url ||
          DEFAULT_PACKAGES_PAGE_CONTENT.hero.background_image_url,
        badge: data.hero?.badge ?? DEFAULT_PACKAGES_PAGE_CONTENT.hero.badge,
        title: data.hero?.title ?? DEFAULT_PACKAGES_PAGE_CONTENT.hero.title,
        subtitle: data.hero?.subtitle ?? DEFAULT_PACKAGES_PAGE_CONTENT.hero.subtitle,
        pillars:
          Array.isArray(data.hero?.pillars) && data.hero.pillars.length > 0
            ? data.hero.pillars.map((p, i) => ({
                label: p.label || DEFAULT_PACKAGES_PAGE_CONTENT.hero.pillars[i]?.label || '',
                icon_key: p.icon_key || DEFAULT_PACKAGES_PAGE_CONTENT.hero.pillars[i]?.icon_key || 'shield',
              }))
            : DEFAULT_PACKAGES_PAGE_CONTENT.hero.pillars,
      },
      search: {
        placeholder:
          data.search?.placeholder ?? DEFAULT_PACKAGES_PAGE_CONTENT.search.placeholder,
      },
      empty_state: {
        title: data.empty_state?.title ?? DEFAULT_PACKAGES_PAGE_CONTENT.empty_state.title,
        description:
          data.empty_state?.description ?? DEFAULT_PACKAGES_PAGE_CONTENT.empty_state.description,
        button_text:
          data.empty_state?.button_text ?? DEFAULT_PACKAGES_PAGE_CONTENT.empty_state.button_text,
      },
      bottom_cta: {
        badge: data.bottom_cta?.badge ?? DEFAULT_PACKAGES_PAGE_CONTENT.bottom_cta.badge,
        title: data.bottom_cta?.title ?? DEFAULT_PACKAGES_PAGE_CONTENT.bottom_cta.title,
        description:
          data.bottom_cta?.description ?? DEFAULT_PACKAGES_PAGE_CONTENT.bottom_cta.description,
        button_text:
          data.bottom_cta?.button_text ?? DEFAULT_PACKAGES_PAGE_CONTENT.bottom_cta.button_text,
        button_link:
          data.bottom_cta?.button_link ?? DEFAULT_PACKAGES_PAGE_CONTENT.bottom_cta.button_link,
      },
    };
  } catch (err) {
    console.warn('Failed to load packages_page_content, using defaults:', err);
    return DEFAULT_PACKAGES_PAGE_CONTENT;
  }
}
