import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Destinations',
  description: 'Explore the destinations we plan trips to, each with its own curated set of packages.',
};

export default async function DestinationsPage() {
  const supabase = await createClient();
  const { data: destinations } = await supabase
    .from('destinations')
    .select('id, name, slug, country, description, cover_image_url')
    .eq('status', 'published')
    .order('sort_order');

  return (
    <div className="container-page py-12">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink-900">Destinations</h1>
        <p className="mt-2 text-ink-500">{(destinations ?? []).length} places we know well</p>
      </div>

      {(destinations ?? []).length === 0 ? (
        <p className="py-16 text-center text-ink-400">Destinations are being added — check back soon.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(destinations ?? []).map((d) => (
            <Link
              key={d.id}
              href={`/destinations/${d.slug}`}
              className="card group overflow-hidden transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-[4/3] bg-ink-100">
                {d.cover_image_url ? (
                  <Image
                    src={d.cover_image_url}
                    alt={d.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 90vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-ink-300">No image</div>
                )}
              </div>
              <div className="p-4">
                <h2 className="font-display text-lg font-semibold text-ink-900">{d.name}</h2>
                {d.country && <p className="text-sm text-ink-400">{d.country}</p>}
                {d.description && <p className="mt-2 text-sm text-ink-500 line-clamp-2">{d.description}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
