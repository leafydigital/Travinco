/**
 * Validation for the Theme page editors. Used client-side (block the save and
 * highlight fields) and in the server actions (so it can't be bypassed).
 *
 * Every validator returns errors keyed by the field's path in the content
 * object (e.g. "hero.button_text", "testimonials.items.2.name"); editors tag
 * their inputs with `data-field="<path>"` so the field can be highlighted.
 * An empty object means the content is valid.
 */
import { isValidPhoneNumber } from 'libphonenumber-js';
import { validateEmailAddress } from './contact-rules';
import { isFakePhone } from './phone';
import { isValidLink, isValidUrl } from './links';
import type { HomePageContent } from '@/lib/home-page-content-types';
import type { AboutPageContent } from '@/lib/about-page-content-types';
import type { ContactPageContent } from '@/lib/contact-page-content-types';
import type { NavbarFooterContent } from '@/lib/navbar-footer-content-types';
import type { PageTitlesContent } from '@/lib/page-titles-content-types';

export type ThemeErrors = Record<string, string>;

const blank = (v: unknown) => typeof v !== 'string' || v.trim() === '';

export { isValidLink, isValidUrl };

export function isValidThemePhone(value: string): boolean {
  const v = value.trim();
  return isValidPhoneNumber(v, 'IN') && !isFakePhone(v);
}

/** Collects errors under a section name, e.g. "Hero: Button text is required". */
class Checker {
  errors: ThemeErrors = {};
  constructor(private section = '') {}

  in(section: string) {
    this.section = section;
    return this;
  }

  private add(path: string, message: string) {
    if (!this.errors[path]) this.errors[path] = this.section ? `${this.section}: ${message}` : message;
  }

  required(path: string, value: unknown, label: string, max?: number) {
    if (blank(value)) this.add(path, `${label} is required`);
    else if (max && (value as string).trim().length > max) this.add(path, `${label} must be ${max} characters or fewer`);
  }

  /** Button links: required, and a site path or full URL. */
  link(path: string, value: unknown, label: string, { required = true } = {}) {
    if (blank(value)) {
      if (required) this.add(path, `${label} is required`);
    } else if (!isValidLink(value as string)) {
      this.add(path, `${label} must be a page path like /packages or a full link starting with https://`);
    }
  }

  url(path: string, value: unknown, label: string) {
    if (!blank(value) && !isValidUrl(value as string)) {
      this.add(path, `${label} must be a full link starting with https://`);
    }
  }

  phone(path: string, value: unknown, label: string) {
    if (!blank(value) && !isValidThemePhone(value as string)) this.add(path, `${label} is not a valid phone number`);
  }

  email(path: string, value: unknown, label: string) {
    if (!blank(value) && validateEmailAddress(value as string)) this.add(path, `${label} is not a valid email address`);
  }

  custom(path: string, message: string) {
    this.add(path, message);
  }
}

/** Hero pillars / small badges: each one shown needs a label. */
function checkPillars(c: Checker, path: string, pillars: { label?: string }[] | undefined) {
  (pillars ?? []).forEach((p, i) => c.required(`${path}.${i}.label`, p?.label, `Highlight ${i + 1} label`));
}

/* ── Home ─────────────────────────────────────────────────────────────── */

export function validateHomePageContent(content: HomePageContent): ThemeErrors {
  const c = new Checker();

  c.in('Hero');
  c.required('hero.title', content.hero?.title, 'Main heading');
  c.required('hero.button_text', content.hero?.button_text, 'Button label');
  c.link('hero.button_link', content.hero?.button_link, 'Button link');

  c.in('Destinations');
  c.required('destinations.title', content.destinations?.title, 'Title');
  c.required('destinations.cta_text', content.destinations?.cta_text, 'Button text');

  c.in('Why choose us');
  c.required('experience.title', content.experience?.title, 'Title');
  (content.experience?.cards ?? []).forEach((card, i) => {
    c.required(`experience.cards.${i}.title`, card.title, `Card ${i + 1} title`);
    c.required(`experience.cards.${i}.body`, card.body, `Card ${i + 1} text`);
  });
  (content.experience?.stats ?? []).forEach((s, i) => {
    c.required(`experience.stats.${i}.value`, s.value, `Stat ${i + 1} value`);
    c.required(`experience.stats.${i}.label`, s.label, `Stat ${i + 1} label`);
  });

  c.in('Captured on the road');
  c.required('captured_road.title', content.captured_road?.title, 'Title');

  c.in('How it works');
  c.required('how_it_works.title', content.how_it_works?.title, 'Title');
  (content.how_it_works?.steps ?? []).forEach((s, i) => {
    c.required(`how_it_works.steps.${i}.title`, s.title, `Step ${i + 1} title`);
    c.required(`how_it_works.steps.${i}.body`, s.body, `Step ${i + 1} text`);
  });

  c.in('Ayurveda');
  c.required('ayurveda.title', content.ayurveda?.title, 'Title');
  c.required('ayurveda.button_text', content.ayurveda?.button_text, 'Button label');
  c.link('ayurveda.button_link', content.ayurveda?.button_link, 'Button link');

  c.in('Testimonials');
  c.required('testimonials.title', content.testimonials?.title, 'Title');
  (content.testimonials?.items ?? []).forEach((t, i) => {
    c.required(`testimonials.items.${i}.name`, t.name, `Testimonial ${i + 1} name`, 80);
    c.required(`testimonials.items.${i}.quote`, t.quote, `Testimonial ${i + 1} quote`);
    const rating = Number(t.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      c.custom(`testimonials.items.${i}.rating`, `Testimonial ${i + 1} rating must be between 1 and 5`);
    }
  });

  c.in('Blog');
  c.required('blog.title', content.blog?.title, 'Title');
  c.required('blog.cta_text', content.blog?.cta_text, 'Button text');

  c.in('Final call to action');
  c.required('final_cta.title', content.final_cta?.title, 'Title');
  c.required('final_cta.button_text', content.final_cta?.button_text, 'Button label');
  c.link('final_cta.button_link', content.final_cta?.button_link, 'Button link');

  return c.errors;
}

/* ── Packages / Destinations / Blog listing pages (same shape) ────────── */

type ListingPageContent = {
  hero: { title: string; pillars?: { label?: string }[] };
  empty_state: { title: string; button_text: string };
  bottom_cta: { title: string; button_text: string; button_link: string };
};

export function validateListingPageContent(content: ListingPageContent): ThemeErrors {
  const c = new Checker();
  c.in('Hero');
  c.required('hero.title', content.hero?.title, 'Title');
  checkPillars(c, 'hero.pillars', content.hero?.pillars);

  c.in('No results message');
  c.required('empty_state.title', content.empty_state?.title, 'Title');
  c.required('empty_state.button_text', content.empty_state?.button_text, 'Button text');

  c.in('Bottom call to action');
  c.required('bottom_cta.title', content.bottom_cta?.title, 'Title');
  c.required('bottom_cta.button_text', content.bottom_cta?.button_text, 'Button text');
  c.link('bottom_cta.button_link', content.bottom_cta?.button_link, 'Button link');
  return c.errors;
}

/* ── About ────────────────────────────────────────────────────────────── */

export function validateAboutPageContent(content: AboutPageContent): ThemeErrors {
  const c = new Checker();
  c.in('Hero');
  c.required('hero.title', content.hero?.title, 'Title');
  checkPillars(c, 'hero.pillars', content.hero?.pillars);

  c.in('Our story');
  c.required('story.title', content.story?.title, 'Title');
  c.required('story.paragraph_1', content.story?.paragraph_1, 'First paragraph');
  (content.story?.stats ?? []).forEach((s, i) => {
    c.required(`story.stats.${i}.value`, s.value, `Stat ${i + 1} value`);
    c.required(`story.stats.${i}.label`, s.label, `Stat ${i + 1} label`);
  });

  c.in('Overview cards');
  (content.overview_cards ?? []).forEach((card, i) => {
    c.required(`overview_cards.${i}.heading`, card.heading, `Card ${i + 1} heading`);
    c.required(`overview_cards.${i}.text`, card.text, `Card ${i + 1} text`);
  });

  c.in('FAQs');
  c.required('faqs.title', content.faqs?.title, 'Title');
  (content.faqs?.items ?? []).forEach((f, i) => {
    c.required(`faqs.items.${i}.question`, f.question, `Question ${i + 1}`);
    c.required(`faqs.items.${i}.answer`, f.answer, `Answer ${i + 1}`);
  });

  c.in('Our values');
  c.required('values.title', content.values?.title, 'Title');
  (content.values?.items ?? []).forEach((v, i) => {
    c.required(`values.items.${i}.title`, v.title, `Value ${i + 1} title`);
    c.required(`values.items.${i}.description`, v.description, `Value ${i + 1} description`);
  });

  c.in('Bottom call to action');
  c.required('bottom_cta.title', content.bottom_cta?.title, 'Title');
  c.required('bottom_cta.button_text', content.bottom_cta?.button_text, 'Button text');
  c.link('bottom_cta.button_link', content.bottom_cta?.button_link, 'Button link');
  return c.errors;
}

/* ── Contact ──────────────────────────────────────────────────────────── */

export function validateContactPageContent(content: ContactPageContent): ThemeErrors {
  const c = new Checker();
  c.in('Hero');
  c.required('hero.title', content.hero?.title, 'Title');
  checkPillars(c, 'hero.pillars', content.hero?.pillars);

  c.in('Contact details');
  c.phone('phone', content.phone, 'Phone');
  c.phone('whatsapp', content.whatsapp, 'WhatsApp number');
  c.email('email', content.email, 'Email');
  c.url('map_embed_url', content.map_embed_url, 'Map embed link');
  return c.errors;
}

/* ── Navbar & footer ──────────────────────────────────────────────────── */

export function validateNavbarFooterContent(content: NavbarFooterContent): ThemeErrors {
  const c = new Checker();
  const nav = content.navbar;
  const footer = content.footer;

  c.in('Navbar');
  if (nav?.logo_type !== 'image') c.required('navbar.logo_text', nav?.logo_text, 'Logo text', 40);
  if (nav?.logo_type !== 'text' && blank(nav?.logo_image_url)) {
    c.custom('navbar.logo_image_url', 'Upload a logo image, or switch the logo type to text');
  }
  c.required('navbar.cta_button_text', nav?.cta_button_text, 'Button text', 30);
  c.link('navbar.cta_button_url', nav?.cta_button_url, 'Button link');
  (nav?.nav_links ?? []).forEach((l, i) => {
    if (!l.visible) return;
    c.required(`navbar.nav_links.${i}.label`, l.label, `Menu link ${i + 1} label`, 30);
    c.link(`navbar.nav_links.${i}.href`, l.href, `Menu link ${i + 1} address`);
  });

  c.in('Footer');
  c.required('footer.brand_name', footer?.brand_name, 'Brand name');
  c.phone('footer.phone', footer?.phone, 'Phone');
  c.email('footer.email', footer?.email, 'Email');
  for (const key of ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube'] as const) {
    c.url(`footer.social.${key}`, footer?.social?.[key], `${key[0]!.toUpperCase()}${key.slice(1)} link`);
  }
  c.required('footer.explore_heading', footer?.explore_heading, 'Explore column heading');
  c.required('footer.company_heading', footer?.company_heading, 'Company column heading');
  c.required('footer.contact_heading', footer?.contact_heading, 'Contact column heading');
  for (const col of ['explore_links', 'company_links'] as const) {
    const name = col === 'explore_links' ? 'Explore' : 'Company';
    (footer?.[col] ?? []).forEach((l, i) => {
      c.required(`footer.${col}.${i}.label`, l.label, `${name} link ${i + 1} label`);
      c.link(`footer.${col}.${i}.href`, l.href, `${name} link ${i + 1} address`);
    });
  }
  return c.errors;
}

/* ── Browser tab titles ───────────────────────────────────────────────── */

export function validatePageTitlesContent(content: PageTitlesContent): ThemeErrors {
  const c = new Checker('Page titles');
  for (const [key, title] of Object.entries(content.titles ?? {})) {
    c.required(`titles.${key}`, title, `${key[0]!.toUpperCase()}${key.slice(1)} page title`, 70);
  }
  return c.errors;
}

/** First message, for server actions that return a single error string. */
export function firstThemeError(errors: ThemeErrors): string | null {
  return Object.values(errors)[0] ?? null;
}
