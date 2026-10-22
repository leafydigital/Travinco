export interface PageTitleConfig {
  key: string;
  name: string;
  path: string;
  defaultTitle: string;
  description: string;
}

export interface PageTitlesContent {
  favicon_url: string;
  titles: {
    home: string;
    packages: string;
    destinations: string;
    blog: string;
    about: string;
    contact: string;
    events: string;
    booking: string;
    [key: string]: string;
  };
}

export const PAGE_DEFINITIONS: PageTitleConfig[] = [
  {
    key: 'home',
    name: 'Home Page',
    path: '/',
    defaultTitle: 'Travinco — Curated holidays, planned end to end',
    description: 'Main landing page featuring hero slider, why choose us, wellness section, and featured packages.',
  },
  {
    key: 'packages',
    name: 'Packages Page',
    path: '/packages',
    defaultTitle: 'Packages | Handcrafted Holiday Tours & Retreats',
    description: 'Tours catalog and holiday packages explorer with search, sorting, and category filters.',
  },
  {
    key: 'destinations',
    name: 'Destinations Page',
    path: '/destinations',
    defaultTitle: 'Destinations | Handcrafted Holiday Regions & Sanctuaries',
    description: 'Destinations directory showcasing travel spots and regional itineraries.',
  },
  {
    key: 'blog',
    name: 'Blog Page',
    path: '/blog',
    defaultTitle: 'Blog & Travel Stories | Travinco',
    description: 'Travel articles, destination guides, insider tips, and customer stories.',
  },
  {
    key: 'about',
    name: 'About Us Page',
    path: '/about',
    defaultTitle: 'About Us | Travinco',
    description: 'Agency story, pillars, team values, service highlights, and FAQs.',
  },
  {
    key: 'contact',
    name: 'Contact Us Page',
    path: '/contact',
    defaultTitle: 'Contact Us | Travinco',
    description: 'Contact details, phone, email, WhatsApp, map location, and enquiry message form.',
  },
  {
    key: 'events',
    name: 'Events Page',
    path: '/events',
    defaultTitle: 'Events | Travinco',
    description: 'Upcoming travel meetups, launches, and seasonal events calendar.',
  },
  {
    key: 'booking',
    name: 'Plan Your Trip / Booking Page',
    path: '/booking',
    defaultTitle: 'Plan Your Trip | Travinco',
    description: 'Custom trip builder and quote request form for travelers.',
  },
];

export const DEFAULT_PAGE_TITLES_CONTENT: PageTitlesContent = {
  favicon_url: '/images/green_logo.png',
  titles: {
    home: 'Travinco — Curated holidays, planned end to end',
    packages: 'Packages | Handcrafted Holiday Tours & Retreats',
    destinations: 'Destinations | Handcrafted Holiday Regions & Sanctuaries',
    blog: 'Blog & Travel Stories | Travinco',
    about: 'About Us | Travinco',
    contact: 'Contact Us | Travinco',
    events: 'Events | Travinco',
    booking: 'Plan Your Trip | Travinco',
  },
};
