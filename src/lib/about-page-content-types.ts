export interface AboutHeroPillar {
  label: string;
  icon_key?: 'compass' | 'users' | 'shield' | 'heart' | 'sparkles' | 'star';
}

export interface AboutHeroContent {
  background_image_url: string;
  badge: string;
  title: string;
  subtitle: string;
  pillars: AboutHeroPillar[];
}

export interface AboutStatItem {
  value: string;
  label: string;
}

export interface AboutStoryContent {
  badge: string;
  title: string;
  paragraph_1: string;
  paragraph_2: string;
  image_url: string;
  stats: AboutStatItem[];
}

export interface AboutFeatureCard {
  heading: string;
  text: string;
  bullet_points?: string[];
  icon_key?: 'compass' | 'users' | 'shield' | 'heart' | 'sparkles' | 'star' | 'globe' | 'check' | 'briefcase';
}

export interface AboutFaqItem {
  question: string;
  answer: string;
}

export interface AboutFaqSection {
  badge?: string;
  title: string;
  subtitle?: string;
  items: AboutFaqItem[];
}

export interface AboutValueItem {
  icon_key: 'compass' | 'users' | 'shield' | 'heart' | 'sparkles' | 'star';
  title: string;
  description: string;
}

export interface AboutValuesContent {
  badge: string;
  title: string;
  subtitle: string;
  items: AboutValueItem[];
}

export interface AboutBottomCtaContent {
  badge: string;
  title: string;
  description: string;
  button_text: string;
  button_link: string;
}

export interface AboutPageContent {
  hero: AboutHeroContent;
  story: AboutStoryContent;
  overview_cards: AboutFeatureCard[];
  faqs: AboutFaqSection;
  values: AboutValuesContent;
  bottom_cta: AboutBottomCtaContent;
}

export const DEFAULT_ABOUT_OVERVIEW_CARDS: AboutFeatureCard[] = [
  {
    heading: 'Our Core Mission',
    text: 'Our mission as a dedicated tour planner is to inspire travelers by curating seamless and personalized travel experiences. We foster cultural understanding, promote sustainable and responsible tourism, and prioritize complete customer satisfaction. By connecting travelers directly with authentic local experiences, we build a deeper appreciation for diverse destinations worldwide.',
    bullet_points: [],
    icon_key: 'compass',
  },
  {
    heading: 'Who We Are: Passionate Travel Experts',
    text: 'At Travinco, we are committed to crafting unique and immersive journeys that go far beyond standard itineraries. Whether you are seeking a serene holiday in South India, a cultural expedition across Rajasthan, or a customized international vacation, our experienced team ensures a seamless journey from start to finish.',
    bullet_points: [],
    icon_key: 'users',
  },
  {
    heading: 'Comprehensive Domestic & International Travel Services',
    text: 'As a full-service travel agency, Travinco manages every detail of your holiday. We combine deep destination expertise with hassle-free planning so you can focus entirely on enjoying your trip. Our key service offerings include:',
    bullet_points: [
      'Pan-India Tour Packages: Fully customized holiday itineraries across Golden Triangle, Himachal, Goa, Kashmir, and South India.',
      'Expert Kerala Itineraries: Handcrafted Munnar hill station escapes, Alleppey houseboat cruises, and coastal Wayanad tours managed by local travel specialists.',
      'International Holiday Management: End-to-end travel packages covering Southeast Asia, Europe, the Middle East, and beach destinations, complete with flight and stay coordination.',
      'Group & Experiential Travel: Curated staycations, corporate retreats, and group tours tailored to specific budget and schedule preferences.',
    ],
    icon_key: 'globe',
  },
  {
    heading: 'Why Choose Travinco as Your Tour Planner?',
    text: 'Finding a reliable tour planner is key to a stress-free vacation. Here are the core values and features that set Travinco Travel Solutions apart:',
    bullet_points: [
      'Customer-Centric Focus: We customize every detail of your itinerary based on guest preferences, dates, and budget requirements.',
      'Transparent Pricing: Clear breakdowns with no hidden fees or surprise charges during your trip.',
      '24/7 On-Trip Support: Dedicated assistance throughout your journey to ensure every transfer, hotel check-in, and tour activity runs smoothly.',
      'Integrity & Local Expertise: High ethical standards combined with direct ground support to provide authentic travel experiences.',
    ],
    icon_key: 'shield',
  },
];

export const DEFAULT_ABOUT_FAQS: AboutFaqSection = {
  badge: 'FAQ',
  title: 'Frequently Asked Questions About Our Tour Planning Services',
  subtitle: 'Find clear answers to common questions about booking, customizing, and traveling with Travinco.',
  items: [
    {
      question: 'How far in advance should I plan my tour package?',
      answer:
        'We recommend reaching out at least 2 to 4 weeks in advance for domestic India tour packages, and 4 to 8 weeks for international travel packages to secure optimal hotel availability and flight fares.',
    },
    {
      question: 'Can I fully customize my travel itinerary?',
      answer:
        'Yes. As a custom tour planner, every aspect of your trip—including accommodations, transport options, sightseeing schedules, activities and meal plans—can be tailored to your specific preferences.',
    },
    {
      question: 'Does Travinco handle flight and stay coordination for international packages?',
      answer:
        'Yes, we provide end-to-end support including hotel reservations, activity passes, and flight coordination for international holiday packages',
    },
  ],
};

export const DEFAULT_ABOUT_PAGE_CONTENT: AboutPageContent = {
  hero: {
    background_image_url:
      'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=2000&q=80',
    badge: 'Our Heritage & Journey',
    title: 'ABOUT TRAVINCO',
    subtitle:
      'We plan trips the way we’d want them planned for ourselves — with authentic itineraries, honest recommendations, and someone to call whenever you need us.',
    pillars: [
      { label: 'Personally Vetted Stays', icon_key: 'shield' },
      { label: 'Handcrafted Itineraries', icon_key: 'compass' },
      { label: '24/7 On-Ground Support', icon_key: 'heart' },
    ],
  },
  story: {
    badge: 'Who We Are',
    title: 'Crafting meaningful journeys that linger long after you return home',
    paragraph_1:
      'Founded by passionate travelers who believe travel should be immersive, effortless, and deeply personal. We skip generic tourist traps and mass-market packages in favor of private, boutique retreats, scenic rail journeys, and authentic cultural encounters.',
    paragraph_2:
      'Every hotel, luxury houseboat, wildlife lodge, and local guide in our portfolio is visited and vetted firsthand. That means when you set foot in Kerala, Sri Lanka, or Southeast Asia, every detail is seamlessly orchestrated so you can savor every second.',
    image_url:
      'https://images.unsplash.com/photo-1528543606781-2f6e6857f318?auto=format&fit=crop&w=1200&q=80',
    stats: [
      { value: '12+', label: 'Years of Experience' },
      { value: '45+', label: 'Curated Destinations' },
      { value: '98%', label: 'Happy Travelers' },
      { value: '24/7', label: 'Local Support' },
    ],
  },
  overview_cards: DEFAULT_ABOUT_OVERVIEW_CARDS,
  faqs: DEFAULT_ABOUT_FAQS,
  values: {
    badge: 'Why Choose Travinco',
    title: 'Built around the values that matter most to discerning travelers',
    subtitle:
      'From the moment you first reach out until you arrive safely back home, our commitments remain unwavering.',
    items: [
      {
        icon_key: 'compass',
        title: 'Itineraries built around you',
        description:
          'We start with how you actually like to travel — pace, style, interests, and budget — never a rigid one-size-fits-all template.',
      },
      {
        icon_key: 'users',
        title: 'Local partners, vetted directly',
        description:
          'Hotels, chauffeurs, and cultural guides are chosen from relationships we maintain ourselves, not anonymous marketplace listings.',
      },
      {
        icon_key: 'shield',
        title: 'Support while you travel',
        description:
          'If something changes mid-trip or weather shifts, you have a direct concierge number to call — not just an automated email.',
      },
      {
        icon_key: 'heart',
        title: 'Transparent, honest pricing',
        description:
          'What you see in your final quote is what you pay — no surprise hidden fees, resort surcharges, or forced commission stops.',
      },
    ],
  },
  bottom_cta: {
    badge: 'Start Your Story With Us',
    title: 'Ready to design your dream getaway?',
    description:
      'Speak directly with a private travel specialist who will handcraft an itinerary tailored exclusively to your dates and preferences.',
    button_text: 'Plan My Journey',
    button_link: '/booking',
  },
};
