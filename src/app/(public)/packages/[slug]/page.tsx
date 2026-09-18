import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import { Clock, MapPin, Users, Check, X, MessageCircle, Phone, Sparkles } from 'lucide-react';
import { formatCurrency, getVideoEmbedUrl } from '@/lib/utils/format';
import { EnquiryForm } from '@/components/public/enquiry-form';
import { ImageLightbox } from '@/components/public/image-lightbox';
import { getGeneralSettings, getTermsSettings } from '@/lib/settings';
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

  const [{ data: images }, { data: itinerary }, { data: inclusions }, { data: exclusions }, { data: videos }] =
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

  const supabaseForAuth = await createClient();
  const {
    data: { user },
  } = await supabaseForAuth.auth.getUser();

  const { pkg, images, itinerary, inclusions, exclusions, videos, activeOffer } = result;
  const offerPrice = activeOffer
    ? activeOffer.discount_percent
      ? pkg.base_price * (1 - activeOffer.discount_percent / 100)
      : activeOffer.discount_flat
      ? pkg.base_price - activeOffer.discount_flat
      : null
    : null;
  const effectivePrice = offerPrice ?? pkg.discount_price;
  const videoEmbedUrls = [
    getVideoEmbedUrl(pkg.video_url),
    ...videos.map((v) => getVideoEmbedUrl(v.video_url)),
  ].filter((url): url is string => Boolean(url));
  const settings = await getGeneralSettings();
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

      <div className="relative h-[45vh] min-h-[320px] w-full bg-ink-200 pt-20">
        {pkg.cover_image_url && (
          <Image src={pkg.cover_image_url} alt={pkg.title} fill className="object-cover" priority />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-navy-900/85 via-navy-900/20 to-transparent" />
        <div className="container-page absolute inset-x-0 bottom-6 text-white">
          {destination && (
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <MapPin className="h-4 w-4" /> {destination.name}
              {destination.country ? `, ${destination.country}` : ''}
            </p>
          )}
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{pkg.title}</h1>
        </div>
      </div>

      <div className="container-page grid gap-10 py-10 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          <div className="flex flex-wrap gap-4 text-sm text-ink-600">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> {pkg.duration_days} days / {pkg.duration_nights} nights
            </span>
            {pkg.total_seats && (
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" /> Limited to {pkg.total_seats} travelers
              </span>
            )}
          </div>

          {pkg.full_description && (
            <section>
              <h2 className="font-display text-xl font-semibold text-ink-900">Overview</h2>
              <p className="mt-3 whitespace-pre-line text-ink-600">{pkg.full_description}</p>
            </section>
          )}

          {pkg.highlights.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-semibold text-ink-900">Highlights</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {pkg.highlights.map((h: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {h}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {itinerary.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-semibold text-ink-900">Day-by-day itinerary</h2>
              <div className="mt-4 space-y-4">
                {itinerary.map((day) => (
                  <div key={day.id} className="rounded-xl2 border border-ink-100 p-4">
                    <p className="text-sm font-semibold text-brand-700">Day {day.day_number}</p>
                    <p className="mt-0.5 font-medium text-ink-800">{day.title}</p>
                    {day.description && (
                      <p className="mt-1.5 text-sm text-ink-500">{day.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-400">
                      {day.hotel && <span>Stay: {day.hotel}</span>}
                      {day.meals && <span>Meals: {day.meals}</span>}
                      {day.transport && <span>Transport: {day.transport}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(inclusions.length > 0 || exclusions.length > 0) && (
            <section className="grid gap-6 sm:grid-cols-2">
              {inclusions.length > 0 && (
                <div>
                  <h2 className="font-display text-lg font-semibold text-ink-900">Inclusions</h2>
                  <ul className="mt-3 space-y-1.5">
                    {inclusions.map((i) => (
                      <li key={i.id} className="flex items-start gap-2 text-sm text-ink-600">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {i.item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {exclusions.length > 0 && (
                <div>
                  <h2 className="font-display text-lg font-semibold text-ink-900">Exclusions</h2>
                  <ul className="mt-3 space-y-1.5">
                    {exclusions.map((e) => (
                      <li key={e.id} className="flex items-start gap-2 text-sm text-ink-600">
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-coral-500" /> {e.item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {images.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-semibold text-ink-900">Gallery</h2>
              <ImageLightbox
                images={images.map((img) => ({ url: img.image_url, alt: img.alt_text ?? pkg.title }))}
              />
            </section>
          )}

          {videoEmbedUrls.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-semibold text-ink-900">
                {videoEmbedUrls.length > 1 ? 'Videos' : 'Video'}
              </h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {videoEmbedUrls.map((embedUrl, i) => (
                  <div key={embedUrl} className="aspect-video overflow-hidden rounded-xl2 bg-ink-100">
                    <iframe
                      src={embedUrl}
                      title={`${pkg.title} — video ${i + 1}`}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {termsSettings.terms_and_conditions && (
            <section>
              <h2 className="font-display text-lg font-semibold text-ink-900">Terms & conditions</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-ink-500">
                {termsSettings.terms_and_conditions}
              </p>
            </section>
          )}
        </div>

        <aside className="lg:col-span-1">
          <div className="card sticky top-24 space-y-4 p-5">
            <div>
              {activeOffer && (
                <span className="badge-discount mb-2 inline-flex">
                  <Sparkles className="mr-1 h-3 w-3" /> Special offer
                </span>
              )}
              {effectivePrice ? (
                <div>
                  <span className="text-sm text-ink-400 line-through">
                    {formatCurrency(pkg.base_price, pkg.currency)}
                  </span>
                  <p className="text-2xl font-semibold text-brand-700">
                    {formatCurrency(effectivePrice, pkg.currency)}{' '}
                    <span className="text-sm font-normal text-ink-400">/ person</span>
                  </p>
                </div>
              ) : (
                <p className="text-2xl font-semibold text-brand-700">
                  {formatCurrency(pkg.base_price, pkg.currency)}{' '}
                  <span className="text-sm font-normal text-ink-400">/ person</span>
                </p>
              )}
            </div>

            <div className="flex gap-2">
              {settings.whatsapp && (
                <a
                  href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                    `Hi, I'm interested in ${pkg.title}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline flex-1"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              )}
              {settings.phone && (
                <a href={`tel:${settings.phone}`} className="btn-outline flex-1">
                  <Phone className="h-4 w-4" /> Call
                </a>
              )}
            </div>

            <div className="border-t border-ink-100 pt-4">
              <p className="mb-3 text-sm font-semibold text-ink-800">Enquire about this package</p>
              <EnquiryForm
                packageId={pkg.id}
                destinationName={destination?.name}
                buttonLabel="Enquire now"
                isLoggedIn={Boolean(user)}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
