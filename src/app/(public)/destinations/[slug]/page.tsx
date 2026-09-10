import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import { PackageCard } from '@/components/public/package-card';

export const revalidate = 300;

async function getDestination(slug: string) {
  const supabase = await createClient();
  const { data: destination } = await supabase
    .from('destinations')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (!destination) return null;

  const { data: packages } = await supabase
    .from('travel_packages')
    .select(
      'id, title, slug, cover_image_url, duration_days, duration_nights, base_price, discount_price, currency, short_description'
    )
    .eq('destination_id', destination.id)
    .eq('status', 'published');

  return { destination, packages: packages ?? [] };
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const result = await getDestination(params.slug);
  if (!result) return { title: 'Destination not found' };
  return {
    title: result.destination.meta_title || result.destination.name,
    description: result.destination.meta_description || result.destination.description || undefined,
    alternates: { canonical: `/destinations/${result.destination.slug}` },
  };
}

export default async function DestinationDetailPage({ params }: { params: { slug: string } }) {
  const result = await getDestination(params.slug);
  if (!result) notFound();
  const { destination, packages } = result;

  return (
    <div>
      <div className="relative h-[35vh] min-h-[260px] w-full bg-ink-200">
        {destination.cover_image_url && (
          <Image src={destination.cover_image_url} alt={destination.name} fill className="object-cover" priority />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="container-page absolute inset-x-0 bottom-6 text-white">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{destination.name}</h1>
          {destination.country && <p className="text-sm">{destination.country}</p>}
        </div>
      </div>

      <div className="container-page py-10">
        {destination.description && <p className="mb-8 max-w-3xl text-ink-600">{destination.description}</p>}

        <h2 className="mb-4 font-display text-xl font-semibold text-ink-900">
          Packages in {destination.name}
        </h2>
        {packages.length === 0 ? (
          <p className="text-ink-400">No packages published for this destination yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => (
              <PackageCard key={pkg.id} pkg={{ ...pkg, destinationName: destination.name }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
