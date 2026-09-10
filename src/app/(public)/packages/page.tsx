import { createClient } from '@/lib/supabase/server';
import { PackageCard } from '@/components/public/package-card';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Travel packages',
  description: 'Browse our curated collection of holiday packages, handpicked and ready to customize.',
};

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: { destination?: string; category?: string };
}) {
  const supabase = await createClient();

  let query = supabase
    .from('travel_packages')
    .select(
      'id, title, slug, cover_image_url, duration_days, duration_nights, base_price, discount_price, currency, short_description, category, destinations(id, name, slug)'
    )
    .eq('status', 'published')
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false });

  if (searchParams.category) {
    query = query.eq('category', searchParams.category);
  }

  const { data: packages } = await query;

  const filtered = searchParams.destination
    ? (packages ?? []).filter(
        (p) => (p.destinations as { slug: string } | null)?.slug === searchParams.destination
      )
    : packages ?? [];

  const { data: destinations } = await supabase
    .from('destinations')
    .select('id, name, slug')
    .eq('status', 'published')
    .order('name');

  return (
    <div className="container-page py-12">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink-900">Travel packages</h1>
        <p className="mt-2 text-ink-500">
          {filtered.length} curated {filtered.length === 1 ? 'package' : 'packages'} to choose from
        </p>
      </div>

      <form className="mb-8 flex flex-wrap gap-3" method="get">
        <select name="destination" defaultValue={searchParams.destination ?? ''} className="input w-auto">
          <option value="">All destinations</option>
          {(destinations ?? []).map((d) => (
            <option key={d.id} value={d.slug}>
              {d.name}
            </option>
          ))}
        </select>
        <select name="category" defaultValue={searchParams.category ?? ''} className="input w-auto">
          <option value="">All categories</option>
          <option value="honeymoon">Honeymoon</option>
          <option value="family">Family</option>
          <option value="adventure">Adventure</option>
          <option value="group">Group</option>
          <option value="luxury">Luxury</option>
          <option value="budget">Budget</option>
          <option value="pilgrimage">Pilgrimage</option>
        </select>
        <button type="submit" className="btn-outline">
          Filter
        </button>
      </form>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-ink-400">
          No packages match your filters yet. Try a different destination or category.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={{
                ...pkg,
                destinationName: (pkg.destinations as { name: string } | null)?.name,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
