import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Pencil, ArrowLeft } from 'lucide-react';
import { getVideoEmbedUrl } from '@/lib/utils/format';
import { getTermsSettings } from '@/lib/settings';
import { StatusBadge } from '@/components/ui/status-badge';
import { PublishFromPreviewButton } from '../publish-from-preview-button';
import { PackageDetailView } from '@/components/public/package-detail-view';
import type { Tables } from '@/types/database';

type PackageWithDestination = Tables<'travel_packages'> & {
  destinations: { name: string; country: string | null } | null;
};

async function getPreviewData(id: string) {
  const supabase = await createClient();

  const { data: packageRow } = await supabase.from('travel_packages').select('*').eq('id', id).maybeSingle();
  if (!packageRow) return null;

  const [{ data: destinationRow }, { data: images }, { data: itinerary }, { data: inclusions }, { data: exclusions }, { data: videos }, { data: faqs }] =
    await Promise.all([
      packageRow.destination_id
        ? supabase.from('destinations').select('name, country').eq('id', packageRow.destination_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('package_images').select('*').eq('package_id', id).order('sort_order'),
      supabase.from('package_itineraries').select('*').eq('package_id', id).order('day_number'),
      supabase.from('package_inclusions').select('*').eq('package_id', id).order('sort_order'),
      supabase.from('package_exclusions').select('*').eq('package_id', id).order('sort_order'),
      supabase.from('package_videos').select('*').eq('package_id', id).order('sort_order'),
      supabase.from('package_faqs').select('*').eq('package_id', id).order('sort_order'),
    ]);

  const pkg: PackageWithDestination = { ...packageRow, destinations: destinationRow ?? null };

  return {
    pkg,
    images: images ?? [],
    itinerary: itinerary ?? [],
    inclusions: inclusions ?? [],
    exclusions: exclusions ?? [],
    videos: videos ?? [],
    faqs: faqs ?? [],
  };
}

export default async function PackagePreviewPage({ params }: { params: { id: string } }) {
  await requireProfile();
  const result = await getPreviewData(params.id);
  if (!result) notFound();

  const { pkg, images, itinerary, inclusions, exclusions, videos, faqs } = result;
  const termsSettings = await getTermsSettings();
  const destination = pkg.destinations;
  const videoEmbedUrls = [
    getVideoEmbedUrl(pkg.video_url),
    ...videos.map((v) => getVideoEmbedUrl(v.video_url)),
  ].filter((url): url is string => Boolean(url));

  return (
    <div>
      {/* Admin-only preview banner — never shown to a real customer. Makes
          it unmistakable this is a draft/preview, not the live site, and
          gives a one-click way to publish or go back to editing. */}
      <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 bg-navy-900 px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <Link href="/admin/packages" className="flex items-center gap-1 text-sm text-white/80 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to packages
          </Link>
          <span className="text-white/30">|</span>
          <span className="text-sm">
            Previewing <strong>{pkg.title}</strong>
          </span>
          <StatusBadge status={pkg.status} />
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/packages/${pkg.id}`} className="btn-outline border-white/30 bg-transparent text-white hover:bg-white/10">
            <Pencil className="h-4 w-4" /> Continue editing
          </Link>
          {pkg.status !== 'published' && <PublishFromPreviewButton packageId={pkg.id} />}
        </div>
      </div>

      {/* The package's real, permanent public URL */}
      <div className="border-b border-ink-100 bg-ink-50 px-4 py-2 text-center text-xs text-ink-500">
        Public URL once published:{' '}
        <span className="font-mono font-medium text-ink-700">/packages/{pkg.slug}</span>
      </div>

      {/* Hero section */}
      <div className="relative h-[45vh] min-h-[340px] max-h-[520px] w-full overflow-hidden bg-ink-900">
        {pkg.cover_image_url && (
          <Image src={pkg.cover_image_url} alt={pkg.title} fill className="object-cover" priority />
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
        termsAndConditions={termsSettings.terms_and_conditions}
        isDashboardPreview={true}
      />
    </div>
  );
}

