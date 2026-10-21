export interface DestinationsHeroPillar {
  label: string;
  icon_key?: 'shield' | 'compass' | 'sparkles' | 'star';
}

export interface DestinationsHeroContent {
  background_image_url: string;
  badge: string;
  title: string;
  subtitle: string;
  pillars: DestinationsHeroPillar[];
}

export interface DestinationsSearchContent {
  placeholder: string;
}

export interface DestinationsEmptyStateContent {
  title: string;
  description: string;
  button_text: string;
}

export interface DestinationsBottomCtaContent {
  badge: string;
  title: string;
  description: string;
  button_text: string;
  button_link: string;
}

export interface DestinationsPageContent {
  hero: DestinationsHeroContent;
  search: DestinationsSearchContent;
  empty_state: DestinationsEmptyStateContent;
  bottom_cta: DestinationsBottomCtaContent;
}

export const DEFAULT_DESTINATIONS_PAGE_CONTENT: DestinationsPageContent = {
  hero: {
    background_image_url:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2000&q=80',
    badge: 'Curated Regions & Scenic Sanctuaries',
    title: 'DESTINATIONS',
    subtitle:
      'From mist-cloaked tea plantations to sun-drenched coastal lagoons and majestic mountain passes, explore our meticulously planned travel havens across Asia.',
    pillars: [
      { label: 'Personally Inspected Regions', icon_key: 'shield' },
      { label: 'Private Handcrafted Routes', icon_key: 'compass' },
      { label: 'Direct Local Concierge', icon_key: 'sparkles' },
    ],
  },
  search: {
    placeholder: 'Search destinations by name or country (e.g. Kerala, Munnar, Maldives)...',
  },
  empty_state: {
    title: 'No destinations found',
    description:
      'We couldn’t find any destinations matching your search. Try another place name or clear your filters.',
    button_text: 'Show All Destinations',
  },
  bottom_cta: {
    badge: 'Have a specific destination in mind?',
    title: 'Can’t find the place you’re dreaming of?',
    description:
      'Our trip designers build custom itineraries for custom cities, off-the-beaten-path regions, and private island stays worldwide. Tell us where you want to go.',
    button_text: 'Request Custom Destination Plan',
    button_link: '/booking',
  },
};
