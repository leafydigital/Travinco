import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import Image from 'next/image';
import { HeroSearch } from '@/components/public/hero-search';
import { SectionHeading } from '@/components/public/section-heading';
import { PackageCard } from '@/components/public/package-card';
import { testimonials } from '@/lib/testimonials-data';
import { formatDate } from '@/lib/utils/format';
import { ShieldCheck, Wallet, HeadphonesIcon, MapPinned, Quote } from 'lucide-react';

export const revalidate = 120;

export default async function HomePage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: destinations },
    { data: featuredPackages },
    { data: offers },
    { data: events },
    { data: galleryPreview },
  ] = await Promise.all([
    supabase
      .from('destinations')
      .select('id, name, slug, cover_image_url')
      .eq('status', 'published')
      .order('sort_order')
      .limit(6),
    supabase
      .from('travel_packages')
      .select(
        'id, title, slug, cover_image_url, duration_days, duration_nights, base_price, discount_price, currency, short_description, destinations(name)'
      )
      .eq('status', 'published')
      .eq('is_featured', true)
      .limit(6),
    supabase
      .from('offers')
      .select('id, title, slug, discount_percent, discount_flat, image_url, valid_to')
      .eq('status', 'published')
      .gte('valid_to', today)
      .limit(3),
    supabase
      .from('events')
      .select('id, title, slug, event_date, image_url')
      .eq('status', 'published')
      .order('event_date', { ascending: true })
      .limit(3),
    supabase.from('gallery').select('id, image_url, title').eq('status', 'published').limit(8),
  ]);

  const whyChooseUs = [
    { icon: MapPinned, title: 'Itineraries built for you', body: 'Not a template — planned around your dates, pace, and budget.' },
    { icon: ShieldCheck, title: 'Vetted local partners', body: 'Hotels and guides we work with directly, not marketplace listings.' },
    { icon: HeadphonesIcon, title: 'Support while you travel', body: 'A real number to call if plans change mid-trip.' },
    { icon: Wallet, title: 'Transparent pricing', body: 'What you see in the quote is what you pay.' },
  ];

  return (
    <div>
      <section className="relative bg-ink-900 py-24 text-white sm:py-32">
        <div className="container-page relative">
          <p className="mb-3 text-sm font-medium uppercase tracking-wide text-brand-300">
            Trip planning, done properly
          </p>
          <h1 className="max-w-2xl font-display text-4xl font-semibold sm:text-5xl">
            Holidays planned around how you actually like to travel
          </h1>
          <p className="mt-4 max-w-xl text-ink-200">
            Curated packages, custom itineraries, and a team that answers the phone — from the
            first enquiry to the last day of your trip.
          </p>
          <div className="mt-8 max-w-xl">
            <HeroSearch destinations={(destinations ?? []).map((d) => ({ slug: d.slug, name: d.name }))} />
          </div>
        </div>
      </section>

      {(destinations ?? []).length > 0 && (
        <section className="container-page py-16">
          <SectionHeading eyebrow="Where to next" title="Popular destinations" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {(destinations ?? []).map((d) => (
              <Link key={d.id} href={`/destinations/${d.slug}`} className="group">
                <div className="relative aspect-square overflow-hidden rounded-xl2 bg-ink-100">
                  {d.cover_image_url && (
                    <Image
                      src={d.cover_image_url}
                      alt={d.name}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="200px"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <span className="absolute bottom-2 left-2 text-sm font-medium text-white">{d.name}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {(featuredPackages ?? []).length > 0 && (
        <section className="bg-ink-50 py-16">
          <div className="container-page">
            <SectionHeading eyebrow="Handpicked" title="Featured packages" />
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {(featuredPackages ?? []).map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  pkg={{ ...pkg, destinationName: (pkg.destinations as { name: string } | null)?.name }}
                />
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link href="/packages" className="btn-outline">
                View all packages
              </Link>
            </div>
          </div>
        </section>
      )}

      {(offers ?? []).length > 0 && (
        <section className="container-page py-16">
          <SectionHeading eyebrow="Limited time" title="Special offers" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {(offers ?? []).map((o) => (
              <Link key={o.id} href="/offers" className="card group overflow-hidden">
                <div className="relative aspect-video bg-ink-100">
                  {o.image_url && <Image src={o.image_url} alt={o.title} fill className="object-cover" />}
                  <span className="absolute left-3 top-3 badge bg-red-600 text-white">
                    {o.discount_percent ? `${o.discount_percent}% off` : `₹${o.discount_flat} off`}
                  </span>
                </div>
                <div className="p-4">
                  <p className="font-medium text-ink-900 group-hover:text-brand-700">{o.title}</p>
                  <p className="mt-1 text-xs text-ink-400">Until {formatDate(o.valid_to)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="bg-ink-900 py-16 text-white">
        <div className="container-page">
          <SectionHeading eyebrow="Why us" title="Trip planning without the guesswork" />
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {whyChooseUs.map((w) => (
              <div key={w.title}>
                <w.icon className="h-6 w-6 text-brand-300" />
                <p className="mt-3 font-medium">{w.title}</p>
                <p className="mt-1 text-sm text-ink-300">{w.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {(events ?? []).length > 0 && (
        <section className="container-page py-16">
          <SectionHeading eyebrow="Happening soon" title="Upcoming events" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {(events ?? []).map((e) => (
              <Link key={e.id} href="/events" className="card group overflow-hidden">
                <div className="relative aspect-video bg-ink-100">
                  {e.image_url && <Image src={e.image_url} alt={e.title} fill className="object-cover" />}
                </div>
                <div className="p-4">
                  <p className="font-medium text-ink-900 group-hover:text-brand-700">{e.title}</p>
                  {e.event_date && <p className="mt-1 text-xs text-ink-400">{formatDate(e.event_date)}</p>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="bg-ink-50 py-16">
        <div className="container-page">
          <SectionHeading eyebrow="What travelers say" title="Recent trips" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {testimonials.map((t) => (
              <div key={t.name} className="card p-5">
                <Quote className="h-5 w-5 text-brand-300" />
                <p className="mt-3 text-sm text-ink-600">{t.quote}</p>
                <p className="mt-4 text-sm font-medium text-ink-800">{t.name}</p>
                <p className="text-xs text-ink-400">{t.trip}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {(galleryPreview ?? []).length > 0 && (
        <section className="container-page py-16">
          <SectionHeading eyebrow="From the road" title="Gallery" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(galleryPreview ?? []).slice(0, 8).map((img) => (
              <div key={img.id} className="relative aspect-square overflow-hidden rounded-xl2">
                <Image src={img.image_url} alt={img.title ?? ''} fill className="object-cover" />
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/gallery" className="btn-outline">
              View full gallery
            </Link>
          </div>
        </section>
      )}

      <section className="bg-brand-700 py-16 text-white">
        <div className="container-page text-center">
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">Ready to start planning?</h2>
          <p className="mx-auto mt-2 max-w-md text-brand-100">
            Tell us what you have in mind — we&apos;ll take it from there.
          </p>
          <Link href="/booking" className="btn-secondary mt-6 inline-flex bg-white text-brand-700 hover:bg-brand-50">
            Plan my trip
          </Link>
        </div>
      </section>
    </div>
  );
}
