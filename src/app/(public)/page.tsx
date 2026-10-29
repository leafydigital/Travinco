import { Suspense } from 'react';
import { createPublicClient } from '@/lib/supabase/public';
import Link from 'next/link';
import Image from 'next/image';
import { HeroSlider, type HeroSlideItem } from '@/components/public/hero-slider';
import { SectionHeading } from '@/components/public/section-heading';
import { PackageCard } from '@/components/public/package-card';
import { ImageCarousel } from '@/components/public/image-carousel';
import { TestimonialsCarousel } from '@/components/public/testimonials-carousel';
import { ExperienceStats } from '@/components/public/animated-stat';
import { formatDate } from '@/lib/utils/format';
import { CardGridSkeleton } from '@/components/ui/skeleton';
import {
  ShieldCheck,
  Wallet,
  HeadphonesIcon,
  MapPinned,
  ArrowRight,
  Compass,
  Calendar,
  MapPin,
} from 'lucide-react';
import { fetchThemeImages } from '@/lib/theme-images';
import { getHomePageContent, DEFAULT_HOME_PAGE_CONTENT } from '@/lib/home-page-content';
import { PluginSlot } from '@/components/plugins/plugin-slot';

function getExperienceIcon(key: string) {
  switch (key) {
    case 'shield':
      return ShieldCheck;
    case 'headphones':
      return HeadphonesIcon;
    case 'wallet':
      return Wallet;
    case 'map':
    default:
      return MapPinned;
  }
}

import type { Metadata } from 'next';
import { getPageTitlesContent } from '@/lib/page-titles-content';

// Served from cache, refreshed in the background every 60s; admin saves purge it instantly.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const titlesContent = await getPageTitlesContent();
  const title = titlesContent.titles?.home || 'Travinco — Curated holidays, planned end to end';
  return {
    title: { absolute: title },
  };
}

/* ──────────────────────────────────────────────────────────
   DYNAMIC DB SECTIONS (STREAMED WITH SECTION-LEVEL SKELETONS)
   ────────────────────────────────────────────────────────── */

function HomeDestinationsSkeleton({ homeContent }: { homeContent: any }) {
  return (
    <section className="container-page py-12 sm:py-16">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <SectionHeading
          eyebrow={homeContent.destinations?.eyebrow}
          title={homeContent.destinations?.title}
          description={homeContent.destinations?.description}
        />
        <Link
          href="/packages"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-900 transition whitespace-nowrap mb-8"
        >
          <span>{homeContent.destinations?.cta_text || 'View all destinations'}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <CardGridSkeleton count={3} gridClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" />
    </section>
  );
}

async function HomeDestinationsSection({ homeContent }: { homeContent: any }) {
  try {
    const supabase = createPublicClient();
    // Featured destinations first, then the rest by sort order to fill the 3 slots.
    const [{ data: rows }, { data: deletedRows }] = await Promise.all([
      supabase
        .from('destinations')
        .select('id, name, slug, cover_image_url, description, is_featured, is_deleted')
        .eq('status', 'published')
        .order('is_featured', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
      supabase.from('website_settings').select('key').like('key', 'deleted_destination_%'),
    ]);
    const deletedIds = new Set((deletedRows ?? []).map((r: { key: string }) => r.key.replace('deleted_destination_', '')));
    const destinations = (rows ?? []).filter((d) => d.is_deleted !== true && !deletedIds.has(String(d.id)));

    if (destinations.length === 0) return null;

    return (
      <section className="container-page py-12 sm:py-16">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <SectionHeading
            eyebrow={homeContent.destinations?.eyebrow}
            title={homeContent.destinations?.title}
            description={homeContent.destinations?.description}
          />
          <Link
            href="/packages"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-900 transition whitespace-nowrap mb-8"
          >
            <span>{homeContent.destinations?.cta_text || 'View all destinations'}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {destinations.slice(0, 3).map((d) => (
            <Link key={d.id} href={`/packages?destination=${encodeURIComponent(d.slug)}`} className="group block">
              <div className="relative aspect-[4/3] sm:aspect-[16/10] overflow-hidden rounded-2xl bg-ink-100 shadow-md transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl">
                {d.cover_image_url ? (
                  <Image
                    src={d.cover_image_url}
                    alt={d.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-108"
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-brand-900 text-white font-medium">
                    {d.name}
                  </div>
                )}

                {/* Gradient Scrim */}
                <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/40 to-transparent" />

                {/* Top Badge */}
                <div className="absolute top-3.5 left-3.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-xs px-2.5 py-1 text-[11px] font-semibold text-ink-800 shadow-xs">
                    <MapPin className="h-3 w-3 text-brand-600" />
                    <span>{d.name}</span>
                  </span>
                </div>

                {/* Bottom Content */}
                <div className="absolute bottom-0 inset-x-0 p-5 text-white">
                  <h3 className="font-display text-xl font-bold tracking-tight text-white group-hover:text-sand-300 transition-colors">
                    {d.name}
                  </h3>
                  {d.description && (
                    <p className="mt-1.5 text-xs text-white/80 line-clamp-2 font-light">
                      {d.description}
                    </p>
                  )}
                  <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-sand-300 group-hover:translate-x-1 transition-transform">
                    <span>Explore Itineraries</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    );
  } catch (err) {
    console.error('HomeDestinationsSection fetch error:', err);
    return null;
  }
}

function HomePackagesSkeleton() {
  return (
    <section className="section-sand py-16 sm:py-20 border-y border-sand-200/60">
      <div className="container-page">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <SectionHeading
            eyebrow="Curated Journeys"
            title="Handcrafted Tour Packages"
            description="Every itinerary is fully flexible — customize hotels, room categories, activities, and duration to match your preferences."
          />
          <Link
            href="/packages"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-900 transition whitespace-nowrap mb-8"
          >
            <span>Browse all packages</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <CardGridSkeleton count={4} gridClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
      </div>
    </section>
  );
}

async function HomePackagesSection() {
  try {
    const supabase = createPublicClient();
    // Featured packages first, then the newest ones to fill the 4 slots.
    const [{ data: rows }, { data: deletedRows }] = await Promise.all([
      supabase
        .from('travel_packages')
        .select(
          'id, title, slug, cover_image_url, duration_days, duration_nights, base_price, discount_price, currency, short_description, is_featured, is_deleted, destinations(id, name, slug)'
        )
        .eq('status', 'published')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(24),
      supabase.from('website_settings').select('key').like('key', 'deleted_package_%'),
    ]);
    const deletedIds = new Set((deletedRows ?? []).map((r: { key: string }) => r.key.replace('deleted_package_', '')));
    const featuredPackages = (rows ?? []).filter((p) => p.is_deleted !== true && !deletedIds.has(String(p.id)));

    if (featuredPackages.length === 0) return null;

    return (
      <section className="section-sand py-16 sm:py-20 border-y border-sand-200/60">
        <div className="container-page">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
            <SectionHeading
              eyebrow="Curated Journeys"
              title="Handcrafted Tour Packages"
              description="Every itinerary is fully flexible — customize hotels, room categories, activities, and duration to match your preferences."
            />
            <Link
              href="/packages"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-900 transition whitespace-nowrap mb-8"
            >
              <span>Browse all packages</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featuredPackages.slice(0, 4).map((pkg) => {
              const destRaw = pkg.destinations as { name: string } | { name: string }[] | null;
              const destinationName = Array.isArray(destRaw) ? destRaw[0]?.name : destRaw?.name;
              return <PackageCard key={pkg.id} pkg={{ ...pkg, destinationName }} />;
            })}
          </div>

          {/* Custom plan callout */}
          <div className="mt-12 rounded-2xl bg-gradient-to-r from-brand-800 to-navy-900 p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1.5 text-center md:text-left">
              <span className="inline-flex items-center text-xs font-semibold uppercase tracking-wider text-sand-300">
                Can&apos;t find your exact itinerary?
              </span>
              <h3 className="text-xl sm:text-2xl font-bold font-display">
                We design custom vacations from scratch
              </h3>
              <p className="text-sm text-white/80 max-w-xl">
                Tell us where you want to go, your dates, and budget. Our travel specialists will build a private, transparent plan within 24 hours.
              </p>
            </div>
            <Link
              href="/booking"
              className="btn-cta px-6 py-3 text-sm font-semibold shrink-0 shadow-lg"
            >
              Build Custom Itinerary
            </Link>
          </div>
        </div>
      </section>
    );
  } catch (err) {
    console.error('HomePackagesSection fetch error:', err);
    return null;
  }
}

function HomeBlogSkeleton({ homeContent }: { homeContent: any }) {
  return (
    <section className="relative z-10 bg-white py-16 sm:py-20 border-t border-ink-100/60">
      <div className="container-page">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <SectionHeading
            eyebrow={homeContent.blog?.eyebrow}
            title={homeContent.blog?.title}
            description={homeContent.blog?.description}
          />
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-900 transition whitespace-nowrap mb-8"
          >
            <span>{homeContent.blog?.cta_text || 'Read all articles'}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <CardGridSkeleton count={4} gridClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
      </div>
    </section>
  );
}

async function HomeBlogSection({ homeContent }: { homeContent: any }) {
  try {
    const supabase = createPublicClient();
    const { data: recentPosts } = await supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, cover_image_url, created_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(4);

    if (!recentPosts || recentPosts.length === 0) return null;

    return (
      <section className="relative z-10 bg-white py-16 sm:py-20 border-t border-ink-100/60">
        <div className="container-page">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <SectionHeading
              eyebrow={homeContent.blog?.eyebrow}
              title={homeContent.blog?.title}
              description={homeContent.blog?.description}
            />
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-900 transition whitespace-nowrap mb-8"
            >
              <span>{homeContent.blog?.cta_text || 'Read all articles'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {recentPosts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="card-hover group overflow-hidden bg-white rounded-2xl border border-ink-100"
              >
                <div className="relative aspect-video bg-ink-100">
                  {post.cover_image_url && (
                    <Image
                      src={post.cover_image_url}
                      alt={post.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                </div>
                <div className="p-5">
                  <p className="text-xs text-ink-400">{formatDate(post.created_at)}</p>
                  <p className="mt-1.5 font-bold text-ink-900 transition-colors group-hover:text-emerald-600 line-clamp-2">
                    {post.title}
                  </p>
                  {post.excerpt && (
                    <p className="mt-2 text-xs text-ink-500 line-clamp-2 leading-relaxed">
                      {post.excerpt}
                    </p>
                  )}
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 group-hover:translate-x-0.5 transition-transform">
                    Read guide →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    );
  } catch (err) {
    console.error('HomeBlogSection fetch error:', err);
    return null;
  }
}

/* ──────────────────────────────────────────────────────────
   MAIN HOMEPAGE (INSTANT SHELL + STREAMED DYNAMIC SECTIONS)
   ────────────────────────────────────────────────────────── */

export default async function HomePage() {
  let themeImagesRes: any = { data: [] };
  let homeContent: any = DEFAULT_HOME_PAGE_CONTENT;

  try {
    const [tiRes, hcRes] = await Promise.all([
      fetchThemeImages(createPublicClient()),
      getHomePageContent(),
    ]);
    themeImagesRes = tiRes ?? { data: [] };
    homeContent = hcRes || DEFAULT_HOME_PAGE_CONTENT;
  } catch (err: any) {
    console.error('HOMEPAGE DATA FETCH ERROR:', err);
  }

  if (!homeContent) {
    homeContent = DEFAULT_HOME_PAGE_CONTENT;
  }

  const allThemeImages = (themeImagesRes?.data ?? []) as any[];
  const homeThemeImages = allThemeImages.filter(
    (img: any) => img.page === 'home' && img.is_active && !img.is_deleted
  );

  // 1. Hero slides from Theme Page
  const themeHeroImages = homeThemeImages.filter((img: any) => img.placement === 'hero');

  // 2. Captured On The Road images from Theme Page
  const themeRoadImages = homeThemeImages.filter((img: any) => img.placement === 'captured_road');

  // 3. Kerala Ayurveda & Wellness banner image from Theme Page, Content Settings, or fallback local asset
  const themeAyurvedaImage = homeThemeImages.find(
    (img: any) => (img.placement === 'ayurveda' || img.placement === 'wellness') && img.is_active && !img.is_deleted
  );

  const customContentImage =
    homeContent.ayurveda?.image_url &&
    homeContent.ayurveda.image_url !== '/images/kerala-ayurveda-wellness.jpg'
      ? homeContent.ayurveda.image_url
      : null;

  const ayurvedaBgUrl =
    customContentImage ||
    themeAyurvedaImage?.image_url ||
    homeContent.ayurveda?.image_url ||
    '/images/kerala-ayurveda-wellness.jpg';

  // ── Construct Hero Slides ──
  const heroSlides: HeroSlideItem[] = [];

  if (themeHeroImages.length > 0) {
    themeHeroImages.forEach((img: any) => {
      heroSlides.push({
        id: `theme-${img.id}`,
        imageUrl: img.image_url,
        title: 'Discover Asia with us',
        subtitle: 'Explore Beyond Boundaries',
      });
    });
  } else {
    // Fallback slides in case theme has no uploaded images
    heroSlides.push(
      {
        id: 'fallback-maldives',
        imageUrl:
          'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=1920&q=80',
        title: 'Discover Asia with us',
        subtitle: 'Explore Beyond Boundaries',
      },
      {
        id: 'fallback-kerala',
        imageUrl:
          'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1920&q=80',
        title: 'Discover Asia with us',
        subtitle: 'Explore Beyond Boundaries',
      }
    );
  }

  // ── Captured On The Road Images (Managed in Theme Page) ──
  const roadImagesToDisplay =
    themeRoadImages.length > 0
      ? themeRoadImages.map((img: any) => ({
          url: img.image_url,
          alt: img.title || 'Captured on the road',
        }))
      : [
          {
            url: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=1200&q=80',
            alt: 'Coastal paradise drive',
          },
          {
            url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
            alt: 'Tropical serenity',
          },
          {
            url: 'https://images.unsplash.com/photo-1512100356356-de1b84283e18?auto=format&fit=crop&w=1200&q=80',
            alt: 'Island hideaway',
          },
        ];

  return (
    <div className="bg-white">
      {/* ── 1. HERO SECTION: 100vh Full Viewport Slideshow (Renders Immediately) ── */}
      <HeroSlider slides={heroSlides} heroContent={homeContent.hero} />

      {/* ── PLUGIN WIDGET SLOT: HOME TOP (Flight / Hotel Search Widgets) ── */}
      <PluginSlot slot="home-top" />

      {/* ── 2. POPULAR DESTINATIONS SHOWCASE (Streamed Section) ── */}
      <Suspense fallback={<HomeDestinationsSkeleton homeContent={homeContent} />}>
        <HomeDestinationsSection homeContent={homeContent} />
      </Suspense>

      {/* ── 3. SNAPSHOT OF PACKAGES (Streamed Section) ── */}
      <Suspense fallback={<HomePackagesSkeleton />}>
        <HomePackagesSection />
      </Suspense>

      {/* ── 4. THE TRAVINCO DIFFERENCE (WHY CHOOSE US) ── */}
      <section className="section-navy relative overflow-hidden py-20 bg-navy-950 text-white">
        <div className="absolute -right-20 top-0 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute -left-20 bottom-0 h-96 w-96 rounded-full bg-ocean-400/10 blur-3xl" />

        <div className="container-page relative">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-sand-300">
              {homeContent.experience?.eyebrow}
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight">
              {homeContent.experience?.title}
            </h2>
            <p className="mt-3 text-sm text-white/70">
              {homeContent.experience?.description}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {(homeContent.experience?.cards || []).map((card: any) => {
              const Icon = getExperienceIcon(card.icon_key);
              return (
                <div
                  key={card.id || card.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm hover:border-white/20 transition-all hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600/30 text-sand-300 border border-brand-500/20">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-white/80">
                      {card.badge}
                    </span>
                  </div>
                  <h3 className="font-semibold text-base text-white">{card.title}</h3>
                  <p className="mt-2 text-xs text-white/70 leading-relaxed">{card.body}</p>
                </div>
              );
            })}
          </div>

          {/* Quick Stats Strip (Animated Count-Up) */}
          {homeContent.experience?.stats && homeContent.experience.stats.length > 0 && (
            <ExperienceStats stats={homeContent.experience.stats} />
          )}
        </div>
      </section>

      {/* ── PLUGIN WIDGET SLOT: HOME MIDDLE ── */}
      <PluginSlot slot="home-middle" />

      {/* ── 5. REAL TRAVEL MOMENTS: CAPTURED ON THE ROAD (MANAGED IN THEME) ── */}
      {roadImagesToDisplay.length > 0 && (
        <section className="section-aqua py-16 sm:py-20 border-b border-ocean-100">
          <div className="container-page">
            <div className="mb-10 max-w-2xl">
              <SectionHeading
                eyebrow={homeContent.captured_road?.eyebrow}
                title={homeContent.captured_road?.title}
                description={homeContent.captured_road?.description}
              />
            </div>

            <ImageCarousel images={roadImagesToDisplay} />
          </div>
        </section>
      )}

      {/* ── 6. HOW IT WORKS: 3 SIMPLE STEPS ── */}
      <section className="relative z-10 bg-white py-16 sm:py-20 border-b border-ink-100/60">
        <div className="container-page">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-600">
              {homeContent.how_it_works?.eyebrow}
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-ink-900 tracking-tight">
              {homeContent.how_it_works?.title}
            </h2>
            <p className="mt-3 text-sm text-ink-500">
              {homeContent.how_it_works?.description}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 relative">
            {(homeContent.how_it_works?.steps || []).map((s: any, idx: number) => {
              const icons = [Compass, Calendar, ShieldCheck];
              const Icon = icons[idx % icons.length] || Compass;
              return (
                <div
                  key={s.step || idx}
                  className="relative rounded-2xl border border-ink-100 bg-white p-7 shadow-xs hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-5">
                    <span className="font-display text-4xl font-bold text-sand-300">{s.step}</span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-ink-900">{s.title}</h3>
                  <p className="mt-2 text-xs sm:text-sm text-ink-500 leading-relaxed">{s.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 7. REJUVENATING KERALA AYURVEDA & WELLNESS PACKAGES (PARALLAX FIXED SECTION) ── */}
      <section
        className="relative w-full min-h-[580px] lg:min-h-[660px] bg-fixed bg-cover bg-center flex items-center py-20 sm:py-28 overflow-hidden"
        style={{
          backgroundImage: `url('${ayurvedaBgUrl}')`,
          backgroundAttachment: 'fixed',
          backgroundPosition: 'center',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Soft atmospheric gradient scrim */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-black/40 to-black/80 sm:from-black/15 sm:via-black/35 sm:to-black/80 pointer-events-none" />

        <div className="container-page relative z-10 flex justify-end">
          <div className="w-full sm:max-w-xl lg:max-w-xl xl:max-w-2xl rounded-3xl bg-black/60 backdrop-blur-md p-7 sm:p-9 lg:p-11 border border-white/15 shadow-2xl text-white">
            <span className="inline-flex items-center rounded-full bg-emerald-500/25 border border-emerald-400/35 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300 mb-4">
              <span>{homeContent.ayurveda?.eyebrow || 'Ayurveda & Traditional Yoga'}</span>
            </span>

            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white uppercase leading-tight mb-4">
              {homeContent.ayurveda?.title || 'REJUVENATING KERALA AYURVEDA & WELLNESS PACKAGES'}
            </h2>

            <p className="text-sm sm:text-base text-white/90 font-light leading-relaxed mb-8">
              {homeContent.ayurveda?.description || 'Immerse yourself in authentic Kerala Ayurveda packages and traditional Yoga retreats. Experience holistic wellness programs, Panchakarma therapies, and mind-body rejuvenation at top-rated retreat resorts. Complete with customized wellness itineraries, resort bookings, and ground logistics by our local team in Kerala'}
            </p>

            <Link
              href={homeContent.ayurveda?.button_link || '/packages'}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8 py-3.5 text-sm sm:text-base shadow-xl hover:shadow-emerald-600/35 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>{homeContent.ayurveda?.button_text || 'Learn More'}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 8. TRAVELER TESTIMONIALS (CAROUSEL) ── */}
      <section className="section-sand py-16 sm:py-20 border-t border-sand-200/60 relative z-10 bg-sand-50 shadow-[0_-15px_30px_rgba(0,0,0,0.12)]">
        <div className="container-page">
          <div className="mb-10 max-w-2xl">
            <SectionHeading
              eyebrow={homeContent.testimonials?.eyebrow}
              title={homeContent.testimonials?.title}
              description={homeContent.testimonials?.description}
            />
          </div>
          <TestimonialsCarousel items={homeContent.testimonials?.items || []} />
        </div>
      </section>

      {/* ── 9. LATEST BLOG POSTS & TRAVEL GUIDES (Streamed Section) ── */}
      <Suspense fallback={<HomeBlogSkeleton homeContent={homeContent} />}>
        <HomeBlogSection homeContent={homeContent} />
      </Suspense>

      {/* ── PLUGIN WIDGET SLOT: HOME BOTTOM ── */}
      <PluginSlot slot="home-bottom" />

      {/* ── 10. HIGH-IMPACT FINAL CALL TO ACTION ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-800 via-brand-900 to-navy-950 py-20 text-white">
        <div className="absolute -left-16 -top-16 h-72 w-72 rounded-full bg-ocean-300/15 blur-3xl" />
        <div className="absolute -bottom-20 right-0 h-80 w-80 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="container-page relative text-center max-w-3xl mx-auto space-y-6">
          <span className="inline-flex items-center rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-sand-300 backdrop-blur-md">
            {homeContent.final_cta?.badge}
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
            {homeContent.final_cta?.title}
          </h2>
          <p className="text-base sm:text-lg text-white/85 max-w-xl mx-auto font-light leading-relaxed">
            {homeContent.final_cta?.description}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              href={homeContent.final_cta?.button_link || '/booking'}
              className="btn-cta text-sm px-8 py-3.5 font-semibold shadow-xl"
            >
              {homeContent.final_cta?.button_text || 'Plan My Trip'}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
