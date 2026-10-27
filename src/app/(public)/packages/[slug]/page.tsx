import { createClient } from '@/lib/supabase/server';
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

async function getPackage(slug: string) {
  const supabase = await createClient();

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

  const termsSettings = await getTermsSettings();
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

      {/* Hero section placed cleanly under the navbar */}
      <div className="pt-20 bg-ink-950">
        <div className="relative h-[45vh] min-h-[340px] max-h-[520px] w-full overflow-hidden bg-ink-900">
          {pkg.cover_image_url && (
            <Image
              src={pkg.cover_image_url}
              alt={pkg.title}
              fill
              className="object-cover"
              priority
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950/90 via-navy-950/45 to-navy-950/20" />
          <div className="container-page absolute inset-x-0 bottom-8 text-white">
            {destination && (
              <p className="flex items-center gap-1.5 text-sm font-medium text-brand-200 mb-2">
                <MapPin className="h-4 w-4" /> {destination.name}
                {destination.country ? `, ${destination.country}` : ''}
              </p>
            )}
            <h1 className="font-display text-3xl font-bold sm:text-4xl lg:text-5xl text-white drop-shadow-sm">
              {pkg.title}
            </h1>
            {pkg.short_description && (
              <p className="mt-2.5 line-clamp-2 max-w-2xl text-sm sm:text-base text-white/90 font-normal">
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
      />
    </div>
  );
}

