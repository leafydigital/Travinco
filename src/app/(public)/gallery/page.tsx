import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import type { Tables } from '@/types/database';
import { ImageCarousel } from '@/components/public/image-carousel';

export const metadata: Metadata = { title: 'Gallery' };

export default async function GalleryPage() {
  const supabase = await createClient();
  const { data: images } = await supabase
    .from('gallery')
    .select('*')
    .eq('status', 'published')
    .order('country', { ascending: true })
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true });

  const rows = images ?? [];

  // Same two-level grouping as the admin gallery — country is the outer
  // heading, category (place) is the inner heading.
  const byCountry = new Map<string, Map<string, Tables<'gallery'>[]>>();
  for (const img of rows) {
    const countryKey = img.country ?? 'More photos';
    const placeKey = img.category ?? 'More photos';
    if (!byCountry.has(countryKey)) byCountry.set(countryKey, new Map());
    const places = byCountry.get(countryKey)!;
    if (!places.has(placeKey)) places.set(placeKey, []);
    places.get(placeKey)!.push(img);
  }
  const sortedCountries = [...byCountry.keys()].sort((a, b) => {
    if (a === 'More photos') return 1;
    if (b === 'More photos') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="container-page pt-32 pb-12">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink-900">Gallery</h1>
        <p className="mt-2 text-ink-500">Moments from the trips we&apos;ve planned</p>
      </div>

      {rows.length === 0 ? (
        <p className="py-16 text-center text-ink-400">Gallery coming soon.</p>
      ) : (
        <div className="space-y-12">
          {sortedCountries.map((country) => {
            const places = byCountry.get(country)!;
            const sortedPlaces = [...places.keys()].sort((a, b) => {
              if (a === 'More photos') return 1;
              if (b === 'More photos') return -1;
              return a.localeCompare(b);
            });

            return (
              <div key={country}>
                <h2 className="font-display text-2xl font-semibold text-ink-900">{country}</h2>
                <div className="mt-6 space-y-8">
                  {sortedPlaces.map((place) => {
                    const placeImages = places.get(place)!;
                    return (
                      <div key={place}>
                        {place !== 'More photos' && (
                          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-600">
                            {place}
                          </h3>
                        )}
                        <ImageCarousel
                          images={placeImages.map((img) => ({
                            url: img.image_url,
                            alt: img.title ?? '',
                          }))}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
