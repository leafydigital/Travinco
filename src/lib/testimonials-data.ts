// Testimonials are static content for now. The agreed schema (see
// supabase/migrations/) doesn't include a testimonials table — it wasn't
// in the requested table list. If you want these admin-editable, add a
// `testimonials` table (title, author_name, quote, rating, is_published)
// following the same pattern as `gallery`, and swap this file for a
// Supabase query. Content below is original, not copied from any source.

export interface Testimonial {
  name: string;
  trip: string;
  quote: string;
  rating: number;
}

export const testimonials: Testimonial[] = [
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
      'They planned around our kids\u2019 nap schedule without us even asking twice. Small thing, but it told us they were actually listening.',
    rating: 5,
  },
  {
    name: 'Devika S.',
    trip: 'Solo trip to Ladakh',
    quote:
      'I was nervous about traveling alone at altitude. The itinerary paced the acclimatization properly and the local guide was fantastic.',
    rating: 4,
  },
];
