export interface NavPageLink {
  key: string;
  href: string;
  label: string;
  visible: boolean;
}

export interface FooterLinkItem {
  id: string;
  label: string;
  href: string;
}

export interface NavbarContent {
  logo_type: 'text' | 'image' | 'both';
  logo_text: string;
  logo_image_url: string; // Dark / Scrolled logo for light backgrounds
  logo_light_image_url?: string; // Light / Transparent logo for dark hero backgrounds
  cta_button_text: string;
  cta_button_url: string;
  nav_links: NavPageLink[];
}

export interface FooterContent {
  brand_name: string;
  brand_tagline: string;
  show_social: boolean;
  social: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
  };
  explore_heading: string;
  explore_links: FooterLinkItem[];
  company_heading: string;
  company_links: FooterLinkItem[];
  contact_heading: string;
  phone: string;
  email: string;
  address: string;
  copyright_text: string;
}

export interface NavbarFooterContent {
  navbar: NavbarContent;
  footer: FooterContent;
}

export const DEFAULT_NAVBAR_FOOTER_CONTENT: NavbarFooterContent = {
  navbar: {
    logo_type: 'image',
    logo_text: 'Travinco',
    logo_image_url: '/images/green_logo.png',
    logo_light_image_url: '/images/white_logo.png',
    cta_button_text: 'Book with Us',
    cta_button_url: '/booking',
    nav_links: [
      { key: 'home', href: '/', label: 'Home', visible: true },
      { key: 'packages', href: '/packages', label: 'Packages', visible: true },
      { key: 'destinations', href: '/destinations', label: 'Destinations', visible: true },
      { key: 'blog', href: '/blog', label: 'Blog', visible: true },
      { key: 'about', href: '/about', label: 'About', visible: true },
      { key: 'contact', href: '/contact', label: 'Contact', visible: true },
    ],
  },
  footer: {
    brand_name: 'Travinco',
    brand_tagline:
      'Handpicked holidays and end-to-end trip planning, built around how you actually like to travel.',
    show_social: true,
    social: {
      facebook: '',
      instagram: '',
      twitter: '',
      linkedin: '',
      youtube: '',
    },
    explore_heading: 'Explore',
    explore_links: [
      { id: '1', label: 'Packages', href: '/packages' },
      { id: '2', label: 'Destinations', href: '/destinations' },
      { id: '3', label: 'Travel Blog', href: '/blog' },
    ],
    company_heading: 'Company',
    company_links: [
      { id: '1', label: 'About us', href: '/about' },
      { id: '2', label: 'Contact', href: '/contact' },
      { id: '3', label: 'Plan a trip', href: '/booking' },
    ],
    contact_heading: 'Get in touch',
    phone: '',
    email: '',
    address: '',
    copyright_text: 'All rights reserved.',
  },
};
