import type { Metadata } from 'next';
import { getGeneralSettings } from '@/lib/settings';
import { Compass, Users, ShieldCheck, Heart } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About us',
  description: 'How we plan trips, and why travelers keep coming back to us.',
};

const values = [
  {
    icon: Compass,
    title: 'Itineraries built around you',
    body: 'We start with how you actually like to travel — pace, budget, and interests — not a template.',
    accent: 'bg-brand-50 text-brand-600',
  },
  {
    icon: Users,
    title: 'Local partners, vetted directly',
    body: 'Hotels, guides and transport are chosen from relationships we maintain ourselves, not marketplace listings.',
    accent: 'bg-ocean-50 text-ocean-700',
  },
  {
    icon: ShieldCheck,
    title: 'Support while you travel',
    body: 'If something changes mid-trip, you have a number to call — not just a booking confirmation email.',
    accent: 'bg-sand-100 text-sand-700',
  },
  {
    icon: Heart,
    title: 'Honest pricing',
    body: "What you see in a quote is what you pay — no surprise add-ons once you're on the ground.",
    accent: 'bg-coral-50 text-coral-600',
  },
];

export default async function AboutPage() {
  const settings = await getGeneralSettings();

  return (
    <div className="container-page pt-32 pb-14">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-ink-900 sm:text-4xl">
          About {settings.business_name ?? 'us'}
        </h1>
        <p className="mt-4 text-lg text-ink-600">
          We plan trips the way we&apos;d want them planned for us — with an actual itinerary,
          honest recommendations, and someone to call if a flight gets delayed.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2">
        {values.map((v) => (
          <div key={v.title} className="flex gap-4">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${v.accent}`}>
              <v.icon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-medium text-ink-900">{v.title}</h2>
              <p className="mt-1 text-sm text-ink-500">{v.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
