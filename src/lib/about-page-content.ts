import { getSetting } from './settings';
import {
  type AboutPageContent,
  DEFAULT_ABOUT_PAGE_CONTENT,
  DEFAULT_ABOUT_OVERVIEW_CARDS,
  DEFAULT_ABOUT_FAQS,
} from './about-page-content-types';

export * from './about-page-content-types';

/**
 * Retrieves the about page content configuration from website_settings or local fallback.
 * Merges with default configuration for complete resilience.
 * For server components and server actions only.
 */
export async function getAboutPageContent(): Promise<AboutPageContent> {
  try {
    let data = await getSetting<Partial<AboutPageContent>>('about_page_content');
    if (!data) {
      try {
        const fs = await import('node:fs/promises');
        const path = await import('node:path');
        const filePath = path.join(process.cwd(), 'src', 'data', 'about-page-content.json');
        const raw = await fs.readFile(filePath, 'utf8');
        data = JSON.parse(raw);
      } catch {
        // No local backup file yet
      }
    }

    if (!data) return DEFAULT_ABOUT_PAGE_CONTENT;

    return {
      hero: {
        background_image_url:
          data.hero?.background_image_url ||
          DEFAULT_ABOUT_PAGE_CONTENT.hero.background_image_url,
        badge: data.hero?.badge ?? DEFAULT_ABOUT_PAGE_CONTENT.hero.badge,
        title: data.hero?.title ?? DEFAULT_ABOUT_PAGE_CONTENT.hero.title,
        subtitle: data.hero?.subtitle ?? DEFAULT_ABOUT_PAGE_CONTENT.hero.subtitle,
        pillars:
          Array.isArray(data.hero?.pillars) && data.hero.pillars.length > 0
            ? data.hero.pillars.map((p, i) => ({
                label: p.label || DEFAULT_ABOUT_PAGE_CONTENT.hero.pillars[i]?.label || '',
                icon_key: p.icon_key || DEFAULT_ABOUT_PAGE_CONTENT.hero.pillars[i]?.icon_key || 'shield',
              }))
            : DEFAULT_ABOUT_PAGE_CONTENT.hero.pillars,
      },
      story: {
        badge: data.story?.badge ?? DEFAULT_ABOUT_PAGE_CONTENT.story.badge,
        title: data.story?.title ?? DEFAULT_ABOUT_PAGE_CONTENT.story.title,
        paragraph_1: data.story?.paragraph_1 ?? DEFAULT_ABOUT_PAGE_CONTENT.story.paragraph_1,
        paragraph_2: data.story?.paragraph_2 ?? DEFAULT_ABOUT_PAGE_CONTENT.story.paragraph_2,
        image_url:
          data.story?.image_url || DEFAULT_ABOUT_PAGE_CONTENT.story.image_url,
        stats:
          Array.isArray(data.story?.stats) && data.story.stats.length > 0
            ? data.story.stats.map((s, i) => ({
                value: s.value ?? DEFAULT_ABOUT_PAGE_CONTENT.story.stats[i]?.value ?? '',
                label: s.label ?? DEFAULT_ABOUT_PAGE_CONTENT.story.stats[i]?.label ?? '',
              }))
            : DEFAULT_ABOUT_PAGE_CONTENT.story.stats,
      },
      overview_cards:
        Array.isArray(data.overview_cards) && data.overview_cards.length > 0
          ? data.overview_cards.map((c, i) => ({
              heading: c.heading ?? DEFAULT_ABOUT_OVERVIEW_CARDS[i]?.heading ?? '',
              text: c.text ?? DEFAULT_ABOUT_OVERVIEW_CARDS[i]?.text ?? '',
              bullet_points: Array.isArray(c.bullet_points)
                ? c.bullet_points
                : (DEFAULT_ABOUT_OVERVIEW_CARDS[i]?.bullet_points || []),
              icon_key: c.icon_key ?? DEFAULT_ABOUT_OVERVIEW_CARDS[i]?.icon_key ?? 'compass',
            }))
          : DEFAULT_ABOUT_PAGE_CONTENT.overview_cards,
      faqs: {
        badge: data.faqs?.badge ?? DEFAULT_ABOUT_FAQS.badge,
        title: data.faqs?.title || DEFAULT_ABOUT_FAQS.title,
        subtitle: data.faqs?.subtitle ?? DEFAULT_ABOUT_FAQS.subtitle,
        items:
          Array.isArray(data.faqs?.items) && data.faqs.items.length > 0
            ? data.faqs.items.map((it, i) => ({
                question: it.question ?? DEFAULT_ABOUT_FAQS.items[i]?.question ?? '',
                answer: it.answer ?? DEFAULT_ABOUT_FAQS.items[i]?.answer ?? '',
              }))
            : DEFAULT_ABOUT_FAQS.items,
      },
      values: {
        badge: data.values?.badge ?? DEFAULT_ABOUT_PAGE_CONTENT.values.badge,
        title: data.values?.title ?? DEFAULT_ABOUT_PAGE_CONTENT.values.title,
        subtitle: data.values?.subtitle ?? DEFAULT_ABOUT_PAGE_CONTENT.values.subtitle,
        items:
          Array.isArray(data.values?.items) && data.values.items.length > 0
            ? data.values.items.map((it, i) => ({
                icon_key: it.icon_key || DEFAULT_ABOUT_PAGE_CONTENT.values.items[i]?.icon_key || 'compass',
                title: it.title || DEFAULT_ABOUT_PAGE_CONTENT.values.items[i]?.title || '',
                description: it.description || DEFAULT_ABOUT_PAGE_CONTENT.values.items[i]?.description || '',
              }))
            : DEFAULT_ABOUT_PAGE_CONTENT.values.items,
      },
      bottom_cta: {
        badge: data.bottom_cta?.badge ?? DEFAULT_ABOUT_PAGE_CONTENT.bottom_cta.badge,
        title: data.bottom_cta?.title ?? DEFAULT_ABOUT_PAGE_CONTENT.bottom_cta.title,
        description:
          data.bottom_cta?.description ?? DEFAULT_ABOUT_PAGE_CONTENT.bottom_cta.description,
        button_text:
          data.bottom_cta?.button_text ?? DEFAULT_ABOUT_PAGE_CONTENT.bottom_cta.button_text,
        button_link:
          data.bottom_cta?.button_link ?? DEFAULT_ABOUT_PAGE_CONTENT.bottom_cta.button_link,
      },
    };
  } catch (err) {
    console.warn('Failed to load about_page_content, using defaults:', err);
    return DEFAULT_ABOUT_PAGE_CONTENT;
  }
}
