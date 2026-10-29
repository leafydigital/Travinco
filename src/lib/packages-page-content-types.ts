export interface PackagesHeroPillar {
  label: string;
  icon_key?: 'shield' | 'compass' | 'sparkles' | 'star';
}

export interface PackagesHeroContent {
  background_image_url: string;
  badge: string;
  title: string;
  subtitle: string;
  pillars: PackagesHeroPillar[];
}

export interface PackagesSearchContent {
  placeholder: string;
}

export interface PackagesEmptyStateContent {
  title: string;
  description: string;
  button_text: string;
}

export interface PackagesBottomCtaContent {
  badge: string;
  title: string;
  description: string;
  button_text: string;
  button_link: string;
}

export interface PackagesPageContent {
  hero: PackagesHeroContent;
  search: PackagesSearchContent;
  empty_state: PackagesEmptyStateContent;
  bottom_cta: PackagesBottomCtaContent;
  /**
   * Shared terms & conditions shown on every package detail page. Edited in the
   * Theme → Packages tab but stored under its own 'terms' setting (see getTermsSettings).
   */
  terms_and_conditions?: string;
}

export const DEFAULT_PACKAGES_PAGE_CONTENT: PackagesPageContent = {
  hero: {
    background_image_url:
      'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=2000&q=80',
    badge: 'Curated Vacations & Handcrafted Itineraries',
    title: 'PACKAGES',
    subtitle:
      'Discover our handpicked holiday packages, authentic Ayurvedic retreats, and private tailor-made tours. Every itinerary is fully flexible to your rhythm and dates.',
    pillars: [
      { label: 'Personally Vetted Stays', icon_key: 'shield' },
      { label: '100% Customizable', icon_key: 'compass' },
      { label: 'Transparent Pricing', icon_key: 'sparkles' },
    ],
  },
  search: {
    placeholder: 'Search packages by name (e.g. Munnar, Kerala, Maldives)...',
  },
  empty_state: {
    title: 'No packages found',
    description:
      'We couldn’t find any packages matching your search. Try another package name or clear your filters.',
    button_text: 'Show All Packages',
  },
  bottom_cta: {
    badge: 'Looking for a custom route?',
    title: 'We design private custom holidays tailored to you',
    description:
      'Don’t see your dream route? Share your dates, group size, and preferred hotel style — our travel specialists will build a private transparent proposal.',
    button_text: 'Request Custom Plan',
    button_link: '/booking',
  },
};
