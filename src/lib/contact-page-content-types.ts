export interface ContactHeroPillar {
  label: string;
  icon_key?: 'shield' | 'compass' | 'sparkles' | 'clock' | 'message' | 'phone';
}

export interface ContactHeroContent {
  background_image_url: string;
  badge: string;
  title: string;
  subtitle: string;
  pillars: ContactHeroPillar[];
}

export interface ContactPageContent {
  hero: ContactHeroContent;
  /** Overridable phone number displayed on the contact page */
  phone?: string;
  /** Overridable email displayed on the contact page */
  email?: string;
  /** WhatsApp number — used on the contact page and the site header WhatsApp button */
  whatsapp?: string;
  /** Office address shown on the contact page */
  address?: string;
  /** Office working hours shown on the contact page */
  working_hours?: string;
  /** Google Maps embed URL for the map on the contact page */
  map_embed_url?: string;
  info_badge?: string;
  info_title?: string;
  info_subtitle?: string;
  form_badge?: string;
  form_title?: string;
  form_subtitle?: string;
}

export const DEFAULT_CONTACT_PAGE_CONTENT: ContactPageContent = {
  hero: {
    background_image_url:
      'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=2000&q=80',
    badge: "We're Here For You",
    title: 'CONTACT US',
    subtitle:
      'Tell us where you want to go, and our bespoke trip designers will tailor your journey down to the finest detail.',
    pillars: [
      { label: 'Rapid 2-Hour Response', icon_key: 'clock' },
      { label: 'Personal Tour Concierge', icon_key: 'compass' },
      { label: 'Direct WhatsApp Support', icon_key: 'message' },
    ],
  },
  phone: '',
  email: '',
  whatsapp: '',
  address: '',
  working_hours: '',
  map_embed_url: '',
  info_badge: 'Direct Assistance',
  info_title: 'Speak with our travel specialists',
  info_subtitle: 'Reach out via phone, WhatsApp, email, or visit our local concierge office.',
  form_badge: 'Send an Inquiry',
  form_title: 'Plan Your Next Journey With Us',
  form_subtitle: 'Fill out the form below and our destination concierge will prepare your tailored travel proposal.',
};
