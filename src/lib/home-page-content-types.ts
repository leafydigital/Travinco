export interface HeroContent {
  eyebrow: string;
  title: string;
  button_text: string;
  button_link: string;
}

export interface DestinationsContent {
  eyebrow: string;
  title: string;
  description: string;
  cta_text: string;
}

export interface ExperienceCard {
  id: string;
  badge: string;
  title: string;
  body: string;
  icon_key: 'map' | 'shield' | 'headphones' | 'wallet';
}

export interface ExperienceStat {
  value: string;
  label: string;
}

export interface ExperienceContent {
  eyebrow: string;
  title: string;
  description: string;
  cards: ExperienceCard[];
  stats?: ExperienceStat[];
}

export interface CapturedRoadContent {
  eyebrow: string;
  title: string;
  description: string;
}

export interface HowItWorksStep {
  step: string;
  title: string;
  body: string;
}

export interface HowItWorksContent {
  eyebrow: string;
  title: string;
  description: string;
  steps: HowItWorksStep[];
}

export interface TestimonialItem {
  name: string;
  trip: string;
  quote: string;
  rating: number;
}

export interface TestimonialsContent {
  eyebrow: string;
  title: string;
  description: string;
  items: TestimonialItem[];
}

export interface BlogSectionContent {
  eyebrow: string;
  title: string;
  description: string;
  cta_text: string;
}

export interface AyurvedaSectionContent {
  eyebrow: string;
  title: string;
  description: string;
  button_text: string;
  button_link: string;
  image_url?: string;
}

export interface FinalCtaContent {
  badge: string;
  title: string;
  description: string;
  button_text: string;
  button_link: string;
}

export interface HomePageContent {
  hero: HeroContent;
  destinations: DestinationsContent;
  experience: ExperienceContent;
  captured_road: CapturedRoadContent;
  how_it_works: HowItWorksContent;
  ayurveda: AyurvedaSectionContent;
  testimonials: TestimonialsContent;
  blog: BlogSectionContent;
  final_cta: FinalCtaContent;
}

export const DEFAULT_HOME_PAGE_CONTENT: HomePageContent = {
  hero: {
    eyebrow: 'Explore Beyond Boundaries',
    title: 'Discover Asia with us',
    button_text: 'Learn More',
    button_link: '/packages',
  },
  destinations: {
    eyebrow: 'Where to next',
    title: 'Iconic & Handcrafted Destinations',
    description:
      'From sun-kissed turquoise lagoons to tranquil mountain sanctuaries, explore our most coveted travel regions.',
    cta_text: 'View all destinations',
  },
  experience: {
    eyebrow: 'The Travinco Experience',
    title: 'Why Travelers Choose Travinco',
    description:
      'We believe a truly great vacation should feel effortless. Here is how we ensure every moment is memorable.',
    cards: [
      {
        id: 'card-1',
        badge: 'Tailor-Made',
        title: 'Itineraries Built For You',
        body: 'Never a generic one-size-fits-all package. Every route is crafted around your preferred dates, hotel style, and pace.',
        icon_key: 'map',
      },
      {
        id: 'card-2',
        badge: 'Verified Stays',
        title: 'Personally Vetted Stays',
        body: 'We partner directly with boutique luxury hotels, private houseboats, and resorts we have visited and inspected ourselves.',
        icon_key: 'shield',
      },
      {
        id: 'card-3',
        badge: 'Always On Call',
        title: '24/7 Dedicated Support',
        body: 'A dedicated trip coordinator is reachable by phone and WhatsApp from arrival to departure if plans ever change.',
        icon_key: 'headphones',
      },
      {
        id: 'card-4',
        badge: 'Zero Surprises',
        title: 'Transparent Pricing',
        body: 'No hidden taxes, surprise driver tips, or mysterious markups. What is quoted in your itinerary is what you pay.',
        icon_key: 'wallet',
      },
    ],
    stats: [
      { value: '5,000+', label: 'Delighted Travelers' },
      { value: '4.9 ★', label: 'Average Traveler Rating' },
      { value: '100%', label: 'Customizable Plans' },
      { value: '24/7', label: 'Dedicated Local Assistance' },
    ],
  },
  captured_road: {
    eyebrow: "From our travelers' lenses",
    title: 'Captured On The Road',
    description:
      'Unfiltered glimpses of picturesque horizons, serene waters, and joyful moments from past journeys. Click any photo to view full screen.',
  },
  how_it_works: {
    eyebrow: 'Simple & Stress-Free',
    title: 'How Your Journey Begins',
    description:
      'From initial spark to seamless return, we take care of the details so you can focus on the memories.',
    steps: [
      {
        step: '01',
        title: 'Share Your Travel Vision',
        body: 'Tell us where you wish to go, your travel dates, preferred hotel style, and budget. No rigid constraints.',
      },
      {
        step: '02',
        title: 'Receive Your Custom Plan',
        body: 'We hand-tailor a detailed day-by-day itinerary with transparent costs, luxury stays, and private transfers.',
      },
      {
        step: '03',
        title: 'Travel With Complete Peace of Mind',
        body: 'Arrive to private chauffeurs, verified boutique stays, and our concierge team on standby 24/7.',
      },
    ],
  },
  ayurveda: {
    eyebrow: 'Ayurveda & Traditional Yoga',
    title: 'REJUVENATING KERALA AYURVEDA & WELLNESS PACKAGES',
    description:
      'Immerse yourself in authentic Kerala Ayurveda packages and traditional Yoga retreats. Experience holistic wellness programs, Panchakarma therapies, and mind-body rejuvenation at top-rated retreat resorts. Complete with customized wellness itineraries, resort bookings, and ground logistics by our local team in Kerala',
    button_text: 'Learn More',
    button_link: '/packages',
    image_url: '/images/kerala-ayurveda-wellness.jpg',
  },
  testimonials: {
    eyebrow: 'What travelers say',
    title: 'Real Stories From Past Trips',
    description:
      'Read firsthand experiences from travelers who entrusted their vacations to our specialists.',
    items: [
      {
        name: 'Ritika & Arjun',
        trip: 'Kerala backwaters honeymoon',
        quote:
          'Every hotel and houseboat was exactly as described, and our contact answered within minutes whenever we had a question. Genuinely stress-free.',
        rating: 5,
      },
      {
        name: 'The Nair family',
        trip: 'Himachal family trip',
        quote:
          'They planned around our kids’ nap schedule without us even asking twice. Small thing, but it told us they were actually listening.',
        rating: 5,
      },
      {
        name: 'Devika S.',
        trip: 'Solo trip to Ladakh',
        quote:
          'I was nervous about traveling alone at altitude. The itinerary paced the acclimatization properly and the local guide was fantastic.',
        rating: 4,
      },
    ],
  },
  blog: {
    eyebrow: 'From the journal',
    title: 'Travel Stories & Local Guides',
    description:
      'Insider advice, packing checklists, and hidden spots recommended by our destination specialists.',
    cta_text: 'Read all articles',
  },
  final_cta: {
    badge: 'Start Planning Today',
    title: 'Ready For Your Next Unforgettable Journey?',
    description:
      'Let our specialists curate a private, personalized vacation designed exclusively around your rhythm, dates, and dreams.',
    button_text: 'Plan My Trip',
    button_link: '/booking',
  },
};
