import { getSetting } from './settings';
import {
  type HomePageContent,
  DEFAULT_HOME_PAGE_CONTENT,
} from './home-page-content-types';

export * from './home-page-content-types';

/**
 * Retrieves the home page content configuration from website_settings.
 * Gracefully merges with factory defaults if unconfigured or partially configured.
 * This function is for server-side usage (Server Components or Server Actions).
 */
export async function getHomePageContent(): Promise<HomePageContent> {
  try {
    let data = await getSetting<Partial<HomePageContent>>('home_page_content');
    if (!data) {
      try {
        const fs = await import('node:fs/promises');
        const path = await import('node:path');
        const filePath = path.join(process.cwd(), 'src', 'data', 'home-page-content.json');
        const raw = await fs.readFile(filePath, 'utf8');
        data = JSON.parse(raw);
      } catch {
        // No local backup file yet
      }
    }
    if (!data) return DEFAULT_HOME_PAGE_CONTENT;

    return {
      hero: {
        ...DEFAULT_HOME_PAGE_CONTENT.hero,
        ...(data.hero || {}),
      },
      destinations: {
        ...DEFAULT_HOME_PAGE_CONTENT.destinations,
        ...(data.destinations || {}),
      },
      experience: {
        ...DEFAULT_HOME_PAGE_CONTENT.experience,
        ...(data.experience || {}),
        cards:
          Array.isArray(data.experience?.cards) && data.experience.cards.length > 0
            ? data.experience.cards.map((c, i) => ({
                ...(DEFAULT_HOME_PAGE_CONTENT.experience.cards[i] || DEFAULT_HOME_PAGE_CONTENT.experience.cards[0]!),
                ...c,
              }))
            : DEFAULT_HOME_PAGE_CONTENT.experience.cards,
        stats:
          Array.isArray(data.experience?.stats) && data.experience.stats.length > 0
            ? data.experience.stats
            : DEFAULT_HOME_PAGE_CONTENT.experience.stats,
      },
      captured_road: {
        ...DEFAULT_HOME_PAGE_CONTENT.captured_road,
        ...(data.captured_road || {}),
      },
      how_it_works: {
        ...DEFAULT_HOME_PAGE_CONTENT.how_it_works,
        ...(data.how_it_works || {}),
        steps:
          Array.isArray(data.how_it_works?.steps) && data.how_it_works.steps.length > 0
            ? data.how_it_works.steps.map((s, i) => ({
                ...(DEFAULT_HOME_PAGE_CONTENT.how_it_works.steps[i] || DEFAULT_HOME_PAGE_CONTENT.how_it_works.steps[0]!),
                ...s,
              }))
            : DEFAULT_HOME_PAGE_CONTENT.how_it_works.steps,
      },
      ayurveda: {
        ...DEFAULT_HOME_PAGE_CONTENT.ayurveda,
        ...(data.ayurveda || {}),
      },
      testimonials: {
        ...DEFAULT_HOME_PAGE_CONTENT.testimonials,
        ...(data.testimonials || {}),
        items:
          Array.isArray(data.testimonials?.items) && data.testimonials.items.length > 0
            ? data.testimonials.items.map((t, i) => ({
                name: t?.name || DEFAULT_HOME_PAGE_CONTENT.testimonials.items[i]?.name || 'Traveler',
                trip: t?.trip || DEFAULT_HOME_PAGE_CONTENT.testimonials.items[i]?.trip || 'Kerala Tour',
                quote: t?.quote || DEFAULT_HOME_PAGE_CONTENT.testimonials.items[i]?.quote || '',
                rating: typeof t?.rating === 'number' ? t.rating : (DEFAULT_HOME_PAGE_CONTENT.testimonials.items[i]?.rating ?? 5),
              }))
            : DEFAULT_HOME_PAGE_CONTENT.testimonials.items,
      },
      blog: {
        ...DEFAULT_HOME_PAGE_CONTENT.blog,
        ...(data.blog || {}),
      },
      final_cta: {
        ...DEFAULT_HOME_PAGE_CONTENT.final_cta,
        ...(data.final_cta || {}),
      },
    };
  } catch (err) {
    console.warn('Failed to load home_page_content, using defaults:', err);
    return DEFAULT_HOME_PAGE_CONTENT;
  }
}
