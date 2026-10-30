import { createPublicClient } from '@/lib/supabase/public';
import { BackButton } from '@/components/public/back-button';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import { MapPin } from 'lucide-react';
import { getVideoEmbedUrl } from '@/lib/utils/format';
import { getTermsSettings } from '@/lib/settings';
import { PackageDetailView } from '@/components/public/package-detail-view';
import type { Tables } from '@/types/database';

export const revalidate = 300;

type PackageWithDestination = Tables<'travel_packages'> & {
  destinations: Pick<Tables<'destinations'>, 'id' | 'name' | 'slug' | 'country'> | null;
};

/** Published packages for the "Send Enquiry" modal's package dropdown (cached public read). */
async function getEnquiryPackageOptions(): Promise<{ id: string; title: string }[]> {
  const { data } = await createPublicClient()
    .from('travel_packages')
    .select('id, title')
    .eq('status', 'published')
    .order('title');
  return (data ?? []) as { id: string; title: string }[];
}

async function getPackage(slug: string) {
  const supabase = createPublicClient();

  // Fetched as a plain (non-joined) query so the row type comes straight
  // from Tables<'travel_packages'> with no join-string inference involved.
  const { data: packageRow, error: pkgError } = await supabase
    .from('travel_packages')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (pkgError) {
    console.error('Error loading travel package:', pkgError);
    return null;
  }

  if (!packageRow) return null;

  const packageId: string = packageRow.id;

  const { data: destinationRow } = await supabase
    .from('destinations')
    .select('id, name, slug, country')
    .eq('id', packageRow.destination_id)
    .maybeSingle();

  const pkg: PackageWithDestination = {
    ...packageRow,
    destinations: destinationRow ?? null,
  };

  const [{ data: images }, { data: itinerary }, { data: inclusions }, { data: exclusions }, { data: videos }, { data: faqs }] =
    await Promise.all([
      supabase.from('package_images').select('*').eq('package_id', packageId).order('sort_order'),
      supabase
        .from('package_itineraries')
        .select('*')
        .eq('package_id', packageId)
        .order('day_number'),
      supabase.from('package_inclusions').select('*').eq('package_id', packageId).order('sort_order'),
      supabase.from('package_exclusions').select('*').eq('package_id', packageId).order('sort_order'),
      supabase.from('package_videos').select('*').eq('package_id', packageId).order('sort_order'),
      supabase.from('package_faqs').select('*').eq('package_id', packageId).order('sort_order'),
    ]);

  // Same live date-window check as the packages listing page — an offer
  // is only "active" while today falls between valid_from and valid_to,
  // so it reverts on its own once the window closes with no cleanup job.
  const today = new Date().toISOString().slice(0, 10);
  const { data: activeOffer } = await supabase
    .from('offers')
    .select('discount_percent, discount_flat, valid_to')
    .eq('package_id', packageId)
    .eq('status', 'published')
    .lte('valid_from', today)
    .gte('valid_to', today)
    .maybeSingle();

  return {
    pkg,
    images: images ?? [],
    itinerary: itinerary ?? [],
    inclusions: inclusions ?? [],
    exclusions: exclusions ?? [],
    videos: videos ?? [],
    faqs: faqs ?? [],
    activeOffer,
  };
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const result = await getPackage(params.slug);
  if (!result) return { title: 'Package not found' };

  const { pkg } = result;
  const title = pkg.meta_title || pkg.title;
  const description = pkg.meta_description || pkg.short_description || undefined;

  return {
    title,
    description,
    alternates: { canonical: `/packages/${pkg.slug}` },
    openGraph: {
      title,
      description,
      images: pkg.cover_image_url ? [{ url: pkg.cover_image_url }] : undefined,
      type: 'website',
    },
  };
}

export default async function PackageDetailPage({ params }: { params: { slug: string } }) {
  const result = await getPackage(params.slug);
  if (!result) notFound();

  const { pkg, images, itinerary, inclusions, exclusions, videos, faqs, activeOffer } = result;

  const videoEmbedUrls = [
    getVideoEmbedUrl(pkg.video_url),
    ...videos.map((v) => getVideoEmbedUrl(v.video_url)),
  ].filter((url): url is string => Boolean(url));

  const [termsSettings, enquiryPackages] = await Promise.all([
    getTermsSettings(),
    getEnquiryPackageOptions(),
  ]);
  const destinationRaw = pkg.destinations as
    | { name: string; country: string | null }
    | { name: string; country: string | null }[]
    | null;
  const destination = Array.isArray(destinationRaw) ? destinationRaw[0] ?? null : destinationRaw;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: pkg.title,
    description: pkg.short_description ?? undefined,
    touristType: pkg.category,
    offers: {
      '@type': 'Offer',
      price: pkg.discount_price ?? pkg.base_price,
      priceCurrency: pkg.currency,
    },
  };

  return (
    <div>
      {/* eslint-disable-next-line react/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero section placed cleanly under the navbar - Full Width */}
      <div className="pt-20 bg-ink-950 w-full overflow-hidden">
        <div className="relative w-full h-[60vh] sm:h-[70vh] lg:h-[78vh] min-h-[380px] sm:min-h-[460px] max-h-[760px] overflow-hidden bg-ink-950">
          {pkg.cover_image_url && (
            <Image
              src={pkg.cover_image_url}
              alt={pkg.title}
              fill
              className="w-full h-full object-cover object-center"
              priority
              sizes="100vw"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950/90 via-navy-950/40 to-transparent pointer-events-none" />

          <div className="container-page absolute inset-x-0 top-4 sm:top-6 z-10">
            <BackButton
              fallbackHref="/packages"
              label="Back to packages"
              className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white backdrop-blur-md transition hover:bg-black/60 cursor-pointer"
            />
          </div>

          <div className="container-page absolute inset-x-0 bottom-6 sm:bottom-8 text-white z-10">
            {destination && (
              <p className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-brand-300 mb-2 drop-shadow">
                <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-brand-400" /> {destination.name}
                {destination.country ? `, ${destination.country}` : ''}
              </p>
            )}
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white drop-shadow-md break-words">
              {pkg.title}
            </h1>
            {pkg.short_description && (
              <p className="mt-2.5 line-clamp-2 max-w-3xl text-sm sm:text-base text-white/90 font-normal drop-shadow break-words">
                {pkg.short_description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Tabs, Accordions, Modal, and Sticky Price Card */}
      <PackageDetailView
        pkg={pkg}
        destination={destination}
        images={images}
        itinerary={itinerary}
        inclusions={inclusions}
        exclusions={exclusions}
        videoEmbedUrls={videoEmbedUrls}
        faqs={faqs}
        activeOffer={activeOffer}
        termsAndConditions={termsSettings.terms_and_conditions}
        enquiryPackages={enquiryPackages}
      />
    </div>
  );
}

