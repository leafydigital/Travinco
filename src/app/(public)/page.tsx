import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import Image from 'next/image';
import { HeroSearch } from '@/components/public/hero-search';
import { SectionHeading } from '@/components/public/section-heading';
import { TranslatedSectionHeading } from '@/components/public/translated-section-heading';
import { TranslatedCta } from '@/components/public/translated-cta';
import { PackageCard } from '@/components/public/package-card';
import { ImageCarousel } from '@/components/public/image-carousel';
import { testimonials } from '@/lib/testimonials-data';
import { formatDate } from '@/lib/utils/format';
import { ShieldCheck, Wallet, HeadphonesIcon, MapPinned, Quote, ArrowRight, Star } from 'lucide-react';
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
    { data: galleryPreview },
    { data: recentPosts },
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
        'id, title, slug, cover_image_url, tile_image_url, duration_days, duration_nights, base_price, discount_price, currency, short_description, destinations(name)'
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
    supabase.from('gallery').select('id, image_url, title').eq('status', 'published').limit(8),
    supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, cover_image_url, created_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(3),
  ]);

  const heroImageUrl = (destinations ?? []).find((d) => d.cover_image_url)?.cover_image_url ?? null;
  const heroCollage = (destinations ?? [])
    .map((d) => d.cover_image_url)
    .filter((u): u is string => Boolean(u))
    .slice(0, 4);
  const topOffer = (offers ?? [])[0] ?? null;

  const whyChooseUs = [
    { icon: MapPinned, title: 'Itineraries built for you', body: 'Not a template — planned around your dates, pace, and budget.', accent: 'text-brand-300' },
    { icon: ShieldCheck, title: 'Vetted local partners', body: 'Hotels and guides we work with directly, not marketplace listings.', accent: 'text-sand-300' },
    { icon: HeadphonesIcon, title: 'Support while you travel', body: 'A real number to call if plans change mid-trip.', accent: 'text-coral-300' },
    { icon: Wallet, title: 'Transparent pricing', body: 'What you see in the quote is what you pay.', accent: 'text-ocean-300' },
  ];

  return (
    <div>
      {/* HERO — four-panel image collage with a centered headline, matching
          travinco.com's split-image hero. Falls back to a single hero image
          (or a plain brand-colored panel) when fewer than 4 destination
          photos are published yet. */}
      <section className="relative flex min-h-[85vh] items-center overflow-hidden bg-brand-900 text-white">
        <div className="absolute inset-0 grid grid-cols-2 sm:grid-cols-4">
          {(heroCollage.length > 0 ? heroCollage : heroImageUrl ? [heroImageUrl] : []).length === 0 ? (
            <div className="col-span-4 bg-gradient-to-br from-brand-800 to-brand-900" />
          ) : (
            Array.from({ length: 4 }).map((_, i) => {
              const pool = heroCollage.length > 0 ? heroCollage : [heroImageUrl!];
              const src = pool[i % pool.length];
              return (
                <div key={i} className="relative h-full w-full">
                  <Image src={src} alt="" fill priority className="object-cover" sizes="25vw" />
                </div>
              );
            })
          )}
          <div className="absolute inset-0 bg-black/45" />
        </div>

        <div className="container-page relative w-full py-24 text-center">
          <p className="mb-4 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-white/90">
            Explore Beyond Boundaries
          </p>
          <h1 className="font-display text-4xl font-bold uppercase leading-tight sm:text-6xl">
            {settings.business_name ? `Discover Asia with ${settings.business_name}` : 'Discover Asia With Us'}
          </h1>
          <div className="mx-auto mt-6">
            <Link href="/packages" className="btn-cta">
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* QUOTE — short pull-quote band, matching the Mark Twain line on
          travinco.com. */}
      <section className="container-page py-14 text-center">
        <Quote className="mx-auto h-8 w-8 text-ink-200" />
        <p className="mx-auto mt-2 max-w-xl text-lg text-ink-600">
          Sail away from the safe harbor. Explore. Dream. Discover.
        </p>
        <p className="mt-2 text-sm text-ink-400">Mark Twain</p>

        <div className="mx-auto mt-8 max-w-3xl rounded-xl2 bg-white p-3 text-left shadow-lg sm:p-3.5">
          <HeroSearch destinations={(destinations ?? []).map((d) => ({ slug: d.slug, name: d.name }))} />
        </div>
      </section>

      {/* INTRO — "What we do" narrative + image collage. Original copy
          written for this project. */}
      <section className="container-page py-20">
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading title="What We Do" />
            <p className="text-ink-600">
              Welcome to {settings.business_name ?? 'Travinco Travel Solutions'}, a premier travel
              agency built around one idea: a good trip is planned by someone who has actually
              been there. Our itineraries come from relationships we maintain directly with
              hotels, drivers and local guides — not a marketplace of unreviewed listings.
            </p>
            <p className="mt-4 text-ink-600">
              Whether it&apos;s a weekend escape, a family holiday, or a longer multi-destination
              trip, we handle the logistics — accommodation, transport, permits where needed —
              so what&apos;s left for you is the part worth showing up for.
            </p>
            <Link href="/about" className="btn-cta mt-6 inline-flex">
              Learn More <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(galleryPreview ?? []).slice(0, 6).map((img) => (
              <div key={img.id} className="relative aspect-square overflow-hidden rounded-xl2 bg-ink-100">
                <Image src={img.image_url} alt={img.title ?? ''} fill className="object-cover" />
              </div>
            ))}
            {(galleryPreview ?? []).length === 0 && (
              <div className="col-span-2 flex aspect-video items-center justify-center rounded-xl2 bg-ink-100 text-sm text-ink-400 sm:col-span-3">
                Add gallery images to show them here
              </div>
            )}
          </div>
        </div>
      </section>

      {(galleryPreview ?? []).length > 0 && (
        <section className="section-aqua py-16">
          <div className="container-page">
            <SectionHeading eyebrow="From the road" title="A few favorite shots" />
            <div className="mt-8">
              <ImageCarousel
                images={(galleryPreview ?? []).map((img) => ({
                  url: img.image_url,
                  alt: img.title ?? '',
                }))}
              />
            </div>
          </div>
        </section>
      )}

      {/* SNAPSHOT OF PACKAGES — destination-led package cards. */}
      {(featuredPackages ?? []).length > 0 && (
        <section className="section-sand py-20">
          <div className="container-page">
            <SectionHeading
              title="Snapshot of Our Packages"
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
                  <div className="absolute inset-0 bg-gradient-to-t from-navy-900/85 via-navy-900/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 border-b-2 border-coral-400 p-3">
                    <span className="block text-sm font-semibold text-white">{d.name}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-white/70 opacity-0 transition-opacity group-hover:opacity-100">
                      Explore <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* THEMED FEATURE BANNER — full-bleed photo band pointing at whichever
          offer is currently active, matching the "Rejuvenating Kerala"
          style band on travinco.com (full photo, dark overlay, left-aligned
          text block). */}
      {topOffer && (
        <section className="relative overflow-hidden py-24 text-white">
          <div className="absolute inset-0 bg-brand-900">
            {topOffer.image_url && (
              <Image src={topOffer.image_url} alt="" fill className="object-cover opacity-70" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          </div>
          <div className="container-page relative max-w-xl">
            <span className="badge-discount mb-3 inline-flex">Limited time</span>
            <h2 className="font-display text-3xl font-bold uppercase leading-tight sm:text-4xl">
              {topOffer.title}
            </h2>
            <div className="mt-4 h-[3px] w-12 bg-brand-400" />
            <p className="mt-4 text-white/85">
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
          <TranslatedSectionHeading eyebrowKey="home_why_us_eyebrow" titleKey="home_why_us_title" />
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

      {/* HOW IT WORKS — three-step overview of the booking process.
          Original copy and structure. */}
      <section className="container-page py-16">
        <TranslatedSectionHeading eyebrowKey="home_how_it_works_eyebrow" titleKey="home_how_it_works_title" />
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {[
            {
              step: '01',
              title: 'Tell us what you have in mind',
              body: 'Share a destination, a rough budget, or just a feeling — a beach week, a family trip, a solo reset.',
            },
            {
              step: '02',
              title: 'Get a plan built around you',
              body: 'We put together an itinerary and a real quote, not a generic package with your name pasted on top.',
            },
            {
              step: '03',
              title: 'Travel with backup on call',
              body: 'Once you\u2019re on the ground, our team is a phone call away if plans need to change.',
            },
          ].map((s) => (
            <div key={s.step} className="relative rounded-xl2 border border-ink-100 p-6">
              <span className="font-display text-4xl font-semibold text-brand-100">{s.step}</span>
              <p className="mt-3 font-medium text-ink-900">{s.title}</p>
              <p className="mt-1.5 text-sm text-ink-500">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section-aqua py-16">
        <div className="container-page">
          <SectionHeading eyebrow="What travelers say" title="Recent trips" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {testimonials.map((t, i) => {
              const borders = ['border-t-brand-400', 'border-t-sand-400', 'border-t-coral-400', 'border-t-ocean-400'];
              return (
                <div key={t.name} className={`card border-t-4 p-5 ${borders[i % borders.length]}`}>
                  <div className="flex items-center justify-between">
                    <Quote className="h-5 w-5 text-ink-300" />
                    <div className="flex gap-0.5" aria-label={`${t.rating} out of 5 stars`}>
                      {Array.from({ length: 5 }).map((_, starIndex) => (
                        <Star
                          key={starIndex}
                          className={`h-3.5 w-3.5 ${
                            starIndex < t.rating ? 'fill-sand-400 text-sand-400' : 'text-ink-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-ink-600">{t.quote}</p>
                  <p className="mt-4 text-sm font-medium text-ink-800">{t.name}</p>
                  <p className="text-xs text-ink-400">{t.trip}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {(recentPosts ?? []).length > 0 && (
        <section className="container-page py-16">
          <TranslatedSectionHeading eyebrowKey="home_blog_eyebrow" titleKey="home_blog_title" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {(recentPosts ?? []).map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`} className="card-hover group overflow-hidden">
                <div className="relative aspect-video bg-ink-100">
                  {post.cover_image_url && (
                    <Image
                      src={post.cover_image_url}
                      alt={post.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  )}
                </div>
                <div className="p-4">
                  <p className="text-xs text-ink-400">{formatDate(post.created_at)}</p>
                  <p className="mt-1 font-medium text-ink-900 transition-colors group-hover:text-coral-600">
                    {post.title}
                  </p>
                  {post.excerpt && (
                    <p className="mt-1.5 text-sm text-ink-500 line-clamp-2">{post.excerpt}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-navy-900 py-16 text-white">
        <div className="absolute -left-16 -top-16 h-64 w-64 rounded-full bg-ocean-300/10 blur-3xl" />
        <div className="absolute -bottom-20 right-0 h-72 w-72 rounded-full bg-coral-400/10 blur-3xl" />
        <div className="container-page relative text-center">
          <TranslatedCta />
          <Link href="/booking" className="btn-cta mt-6 inline-flex">
            Plan my trip
          </Link>
        </div>
      </section>
    </div>
  );
}
