import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import Image from 'next/image';
import { HeroSearch } from '@/components/public/hero-search';
import { SectionHeading } from '@/components/public/section-heading';
import { PackageCard } from '@/components/public/package-card';
import { testimonials } from '@/lib/testimonials-data';
import { formatDate } from '@/lib/utils/format';
import { ShieldCheck, Wallet, HeadphonesIcon, MapPinned, Quote, ArrowRight } from 'lucide-react';
import { getGeneralSettings } from '@/lib/settings';

export const revalidate = 120;

export default async function HomePage() {
  const supabase = await createClient();
  const settings = await getGeneralSettings();
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

  const heroImageUrl = (destinations ?? []).find((d) => d.cover_image_url)?.cover_image_url ?? null;
  const topOffer = (offers ?? [])[0] ?? null;

  const whyChooseUs = [
    { icon: MapPinned, title: 'Itineraries built for you', body: 'Not a template — planned around your dates, pace, and budget.', accent: 'text-brand-300' },
    { icon: ShieldCheck, title: 'Vetted local partners', body: 'Hotels and guides we work with directly, not marketplace listings.', accent: 'text-sand-300' },
    { icon: HeadphonesIcon, title: 'Support while you travel', body: 'A real number to call if plans change mid-trip.', accent: 'text-coral-300' },
    { icon: Wallet, title: 'Transparent pricing', body: 'What you see in the quote is what you pay.', accent: 'text-ocean-300' },
  ];

  return (
    <div>
      {/* HERO — full-bleed image with dark overlay, tagline + heading + a
          floating "quote" card, mirroring travinco.com's hero pattern
          (small overline, big heading, a Mark-Twain-style quote card,
          primary CTA). All copy is original. */}
      <section className="relative flex min-h-[85vh] items-center overflow-hidden bg-gradient-to-br from-navy-900 via-brand-900 to-brand-800 text-white">
        <div className="absolute inset-0">
          {heroImageUrl ? (
            <Image src={heroImageUrl} alt="" fill priority className="object-cover opacity-25" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-navy-900/90 via-navy-900/50 to-transparent" />
          {/* subtle decorative accent shapes, per the design brief's request
              for travel-inspired gradient shapes rather than a flat block */}
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-ocean-400/10 blur-3xl" />
          <div className="absolute -bottom-32 left-1/3 h-96 w-96 rounded-full bg-coral-400/10 blur-3xl" />
        </div>

        <div className="container-page relative pt-20">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-ocean-300">
            Explore without the guesswork
          </p>
          <h1 className="max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-6xl">
            Trips planned like someone who actually knows the place
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/80">
            Handpicked packages across India and beyond, built around your pace and
            budget — with a real team on call while you travel.
          </p>

          <div className="mt-10 max-w-xl">
            <HeroSearch destinations={(destinations ?? []).map((d) => ({ slug: d.slug, name: d.name }))} />
          </div>

          <div className="mt-14 max-w-md rounded-xl2 border border-white/15 bg-white/10 p-5 backdrop-blur-md">
            <Quote className="h-5 w-5 text-coral-300" />
            <p className="mt-3 font-display text-lg italic text-white/90">
              &ldquo;The trip that stays with you is the one someone actually planned for
              you — not the one assembled from ten browser tabs.&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* INTRO — "What we do" narrative + image collage, mirroring
          travinco.com's introductory block. Original copy throughout. */}
      <section className="container-page py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="What we do" title="Travel planning, taken off your plate" />
            <p className="text-ink-600">
              We&apos;re {settings.business_name ?? 'a travel planning studio'}, built around one
              idea: a good trip is planned by someone who has actually been there. Our
              itineraries come from relationships we maintain directly with hotels, drivers and
              local guides — not a marketplace of unreviewed listings.
            </p>
            <p className="mt-4 text-ink-600">
              Whether it&apos;s a weekend escape, a family holiday, or a longer multi-destination
              trip, we handle the logistics — accommodation, transport, permits where needed —
              so what&apos;s left for you is the part worth showing up for.
            </p>
            <Link href="/about" className="btn-outline mt-6 inline-flex">
              More about us <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(galleryPreview ?? []).slice(0, 4).map((img, i) => (
              <div
                key={img.id}
                className={`relative overflow-hidden rounded-xl2 bg-ink-100 ${
                  i === 0 ? 'col-span-2 aspect-video' : 'aspect-square'
                }`}
              >
                <Image src={img.image_url} alt={img.title ?? ''} fill className="object-cover" />
              </div>
            ))}
            {(galleryPreview ?? []).length === 0 && (
              <div className="col-span-2 flex aspect-video items-center justify-center rounded-xl2 bg-ink-100 text-sm text-ink-400">
                Add gallery images to show them here
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SNAPSHOT OF PACKAGES — destination-led package cards, the
          equivalent of travinco.com's "Snapshot of Our Packages" grid. */}
      {(featuredPackages ?? []).length > 0 && (
        <section className="section-sand py-20">
          <div className="container-page">
            <SectionHeading
              eyebrow="Snapshot of our trips"
              title="Featured packages"
              description="A sample of what we plan most often — every one of these is fully customizable."
            />
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {(featuredPackages ?? []).map((pkg) => {
                const destRaw = pkg.destinations as { name: string } | { name: string }[] | null;
                const destinationName = Array.isArray(destRaw) ? destRaw[0]?.name : destRaw?.name;
                return (
                  <PackageCard key={pkg.id} pkg={{ ...pkg, destinationName }} />
                );
              })}
            </div>
            <div className="mt-10 text-center">
              <Link href="/packages" className="btn-outline">
                View all packages
              </Link>
            </div>
          </div>
        </section>
      )}

      {(destinations ?? []).length > 0 && (
        <section className="container-page py-20">
          <SectionHeading eyebrow="Where to next" title="Popular destinations" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {(destinations ?? []).map((d) => (
              <Link key={d.id} href={`/destinations/${d.slug}`} className="group">
                <div className="relative aspect-square overflow-hidden rounded-xl2 bg-ink-100 shadow-sm transition-shadow duration-300 group-hover:shadow-lg">
                  {d.cover_image_url && (
                    <Image
                      src={d.cover_image_url}
                      alt={d.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                      sizes="200px"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-navy-900/80 via-navy-900/10 to-transparent" />
                  <span className="absolute bottom-0 left-0 right-0 border-b-2 border-coral-400 p-3 text-sm font-semibold text-white">
                    {d.name}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* THEMED FEATURE BANNER — full-width promo band, the equivalent of
          travinco.com's Ayurveda/wellness banner. Points at whichever
          offer is currently active rather than a fixed made-up vertical,
          since this system has no wellness-specific data model. */}
      {topOffer && (
        <section className="relative overflow-hidden bg-gradient-to-br from-brand-800 via-brand-700 to-ocean-700 py-20 text-white">
          {topOffer.image_url && (
            <Image src={topOffer.image_url} alt="" fill className="object-cover opacity-20" />
          )}
          <div className="absolute -right-20 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-coral-400/10 blur-3xl" />
          <div className="container-page relative text-center">
            <span className="badge-discount mb-3 inline-flex">Limited time</span>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">{topOffer.title}</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/80">
              {topOffer.discount_percent
                ? `Save ${topOffer.discount_percent}% when you book before ${formatDate(topOffer.valid_to)}.`
                : `Save ₹${topOffer.discount_flat} when you book before ${formatDate(topOffer.valid_to)}.`}
            </p>
            <Link href="/offers" className="btn-cta mt-6 inline-flex">
              View this offer
            </Link>
          </div>
        </section>
      )}

      {(offers ?? []).length > 0 && (
        <section className="container-page py-16">
          <SectionHeading eyebrow="More offers" title="Special offers" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {(offers ?? []).map((o) => (
              <Link key={o.id} href="/offers" className="card-hover group overflow-hidden">
                <div className="relative aspect-video bg-ink-100">
                  {o.image_url && <Image src={o.image_url} alt={o.title} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />}
                  <span className="badge-discount absolute left-3 top-3 shadow-sm">
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

      <section className="section-navy relative overflow-hidden py-16">
        <div className="absolute -right-20 top-0 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="container-page relative">
          <SectionHeading eyebrow="Why us" title="Trip planning without the guesswork" />
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {whyChooseUs.map((w) => (
              <div key={w.title}>
                <w.icon className={`h-6 w-6 ${w.accent}`} />
                <p className="mt-3 font-medium">{w.title}</p>
                <p className="mt-1 text-sm text-white/70">{w.body}</p>
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
              <Link key={e.id} href="/events" className="card-hover group overflow-hidden">
                <div className="relative aspect-video bg-ink-100">
                  {e.image_url && <Image src={e.image_url} alt={e.title} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />}
                  {e.event_date && (
                    <span className="badge-event absolute left-3 top-3">{formatDate(e.event_date)}</span>
                  )}
                </div>
                <div className="p-4">
                  <p className="font-medium text-ink-900 transition-colors group-hover:text-coral-600">{e.title}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="section-aqua py-16">
        <div className="container-page">
          <SectionHeading eyebrow="What travelers say" title="Recent trips" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {testimonials.map((t, i) => {
              const borders = ['border-t-brand-400', 'border-t-sand-400', 'border-t-coral-400', 'border-t-ocean-400'];
              return (
                <div key={t.name} className={`card border-t-4 p-5 ${borders[i % borders.length]}`}>
                  <Quote className="h-5 w-5 text-ink-300" />
                  <p className="mt-3 text-sm text-ink-600">{t.quote}</p>
                  <p className="mt-4 text-sm font-medium text-ink-800">{t.name}</p>
                  <p className="text-xs text-ink-400">{t.trip}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {(galleryPreview ?? []).length > 0 && (
        <section className="container-page py-16">
          <SectionHeading eyebrow="From the road" title="Gallery" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(galleryPreview ?? []).slice(0, 8).map((img) => (
              <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl2 shadow-sm transition-shadow duration-300 hover:shadow-lg">
                <Image
                  src={img.image_url}
                  alt={img.title ?? ''}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-navy-900/0 transition-colors duration-300 group-hover:bg-navy-900/20" />
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

      <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-navy-900 py-16 text-white">
        <div className="absolute -left-16 -top-16 h-64 w-64 rounded-full bg-ocean-300/10 blur-3xl" />
        <div className="absolute -bottom-20 right-0 h-72 w-72 rounded-full bg-coral-400/10 blur-3xl" />
        <div className="container-page relative text-center">
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">Ready to start planning?</h2>
          <p className="mx-auto mt-2 max-w-md text-white/80">
            Tell us what you have in mind — we&apos;ll take it from there.
          </p>
          <Link href="/booking" className="btn-cta mt-6 inline-flex">
            Plan my trip
          </Link>
        </div>
      </section>
    </div>
  );
}
