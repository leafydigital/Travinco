import { getSetting } from './settings';
import {
  type ContactPageContent,
  DEFAULT_CONTACT_PAGE_CONTENT,
} from './contact-page-content-types';

export * from './contact-page-content-types';

/**
 * Retrieves the contact page content configuration from website_settings or local fallback.
 * Merges with default configuration for complete resilience.
 * For server components and server actions only.
 */
export async function getContactPageContent(): Promise<ContactPageContent> {
  try {
    let data = await getSetting<Partial<ContactPageContent>>('contact_page_content');
    if (!data) {
      try {
        const fs = await import('node:fs/promises');
        const path = await import('node:path');
        const filePath = path.join(process.cwd(), 'src', 'data', 'contact-page-content.json');
        const raw = await fs.readFile(filePath, 'utf8');
        data = JSON.parse(raw);
      } catch {
        // No local backup file yet
      }
    }

    if (!data) return DEFAULT_CONTACT_PAGE_CONTENT;

    return {
      hero: {
        background_image_url:
          data.hero?.background_image_url ||
          DEFAULT_CONTACT_PAGE_CONTENT.hero.background_image_url,
        badge: data.hero?.badge ?? DEFAULT_CONTACT_PAGE_CONTENT.hero.badge,
        title: data.hero?.title ?? DEFAULT_CONTACT_PAGE_CONTENT.hero.title,
        subtitle: data.hero?.subtitle ?? DEFAULT_CONTACT_PAGE_CONTENT.hero.subtitle,
        pillars:
          Array.isArray(data.hero?.pillars) && data.hero.pillars.length > 0
            ? data.hero.pillars.map((p, i) => ({
                label: p.label || DEFAULT_CONTACT_PAGE_CONTENT.hero.pillars[i]?.label || '',
                icon_key: p.icon_key || DEFAULT_CONTACT_PAGE_CONTENT.hero.pillars[i]?.icon_key || 'clock',
              }))
            : DEFAULT_CONTACT_PAGE_CONTENT.hero.pillars,
      },
      info_badge: data.info_badge ?? DEFAULT_CONTACT_PAGE_CONTENT.info_badge,
      info_title: data.info_title ?? DEFAULT_CONTACT_PAGE_CONTENT.info_title,
      info_subtitle: data.info_subtitle ?? DEFAULT_CONTACT_PAGE_CONTENT.info_subtitle,
      form_badge: data.form_badge ?? DEFAULT_CONTACT_PAGE_CONTENT.form_badge,
      form_title: data.form_title ?? DEFAULT_CONTACT_PAGE_CONTENT.form_title,
      form_subtitle: data.form_subtitle ?? DEFAULT_CONTACT_PAGE_CONTENT.form_subtitle,
      phone: data.phone ?? DEFAULT_CONTACT_PAGE_CONTENT.phone,
      email: data.email ?? DEFAULT_CONTACT_PAGE_CONTENT.email,
    };
  } catch (error) {
    console.error('getContactPageContent error:', error);
    return DEFAULT_CONTACT_PAGE_CONTENT;
  }
}
