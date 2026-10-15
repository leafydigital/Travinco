import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Clock, MapPin, Users, Check, X, Pencil, ArrowLeft } from 'lucide-react';
import { formatCurrency, getVideoEmbedUrl } from '@/lib/utils/format';
import { getTermsSettings } from '@/lib/settings';
import { StatusBadge } from '@/components/ui/status-badge';
import { PublishFromPreviewButton } from '../publish-from-preview-button';
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

  const coverImages = images.filter((img) => img.is_cover);
  const otherImages = images.filter((img) => !img.is_cover);

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

      {/* The package's real, permanent public URL — shown here so the
          slug is visible and confirmable before publishing, without
          routing the preview page itself by slug (which would break if
          the slug is edited later; the ID-based route never does). */}
      <div className="border-b border-ink-100 bg-ink-50 px-4 py-2 text-center text-xs text-ink-500">
        Public URL once published:{' '}
        <span className="font-mono font-medium text-ink-700">/packages/{pkg.slug}</span>
      </div>

      <div className="relative h-[45vh] min-h-[320px] w-full bg-ink-200">
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
                    {day.description && <p className="mt-1.5 text-sm text-ink-500">{day.description}</p>}
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
              {/* Cover photo(s) called out separately in the preview so it's
                  obvious which image customers will see first — this
                  distinction doesn't exist on the real public page, it's
                  preview-only context for the admin. */}
              {coverImages.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-brand-600">
                    Cover photo
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {coverImages.map((img) => (
                      <div key={img.id} className="relative aspect-square overflow-hidden rounded-lg ring-2 ring-brand-500">
                        <Image src={img.image_url} alt={img.alt_text ?? pkg.title} fill className="object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {otherImages.length > 0 && (
                <div className="mt-4">
                  {coverImages.length > 0 && (
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-400">
                      Other photos
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {otherImages.map((img) => (
                      <div key={img.id} className="relative aspect-square overflow-hidden rounded-lg">
                        <Image src={img.image_url} alt={img.alt_text ?? pkg.title} fill className="object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

          {faqs.length > 0 && (
            <section>
              <h2 className="font-display text-lg font-semibold text-ink-900">
                Frequently asked questions
              </h2>
              <div className="mt-3 space-y-3">
                {faqs.map((faq) => (
                  <div key={faq.id} className="rounded-xl2 border border-ink-100 p-4">
                    <p className="font-medium text-ink-900">{faq.question}</p>
                    <p className="mt-1 text-sm text-ink-500">{faq.answer}</p>
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

          {images.length === 0 && (
            <p className="rounded-lg border border-dashed border-sand-300 bg-sand-50 px-4 py-3 text-sm text-sand-800">
              No photos added yet — customers will see a blank cover area until you add at least
              one image.
            </p>
          )}
        </div>

        <aside className="lg:col-span-1">
          <div className="card sticky top-24 space-y-4 p-5">
            <div>
              {pkg.discount_price ? (
                <div>
                  <span className="text-sm text-ink-400 line-through">
                    {formatCurrency(pkg.base_price, pkg.currency)}
                  </span>
                  <p className="text-2xl font-semibold text-brand-700">
                    {formatCurrency(pkg.discount_price, pkg.currency)}{' '}
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
            <p className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
              This is a preview — the enquiry form and contact buttons that customers would see
              here are hidden, since this page isn&apos;t public yet.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
