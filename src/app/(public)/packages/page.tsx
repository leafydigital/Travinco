import { createClient } from '@/lib/supabase/server';
import { PackagesExplorer, type PackageExplorerItem } from '@/components/public/packages-explorer';
import { getPackagesPageContent } from '@/lib/packages-page-content';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Packages | Handcrafted Holiday Tours & Retreats',
  description: 'Browse our curated collection of holiday packages, authentic Ayurvedic retreats, and custom travel itineraries across India and beyond.',
};

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: { destination?: string; category?: string; search?: string; q?: string };
}) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: packages },
    { data: activeOffers },
    { data: destinations },
    { data: deletedSettingsData },
    pageContent,
  ] = await Promise.all([
    supabase
      .from('travel_packages')
      .select(
        'id, title, slug, cover_image_url, duration_days, duration_nights, base_price, discount_price, currency, short_description, category, is_featured, is_deleted, destinations(id, name, slug)'
      )
      .eq('status', 'published')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('offers')
      .select('package_id, discount_percent, discount_flat, valid_to')
      .eq('status', 'published')
      .lte('valid_from', today)
      .gte('valid_to', today),
    supabase
      .from('destinations')
      .select('id, name, slug')
      .eq('status', 'published')
      .order('name'),
    supabase
      .from('website_settings')
      .select('key')
      .like('key', 'deleted_package_%'),
    getPackagesPageContent(),
  ]);

  const deletedKeys = new Set(
    (deletedSettingsData || []).map((s: { key: string }) => s.key.replace('deleted_package_', ''))
  );

  const offersByPackage = new Map((activeOffers ?? []).map((o) => [o.package_id, o]));

  const mappedPackages: PackageExplorerItem[] = (packages ?? [])
    .filter((pkg) => !deletedKeys.has(pkg.id) && (pkg as any).is_deleted !== true)
    .map((pkg) => {
      const dest = pkg.destinations as
        | { id?: string; name: string; slug: string }
        | { id?: string; name: string; slug: string }[]
        | null;
      const destinationName = Array.isArray(dest) ? dest[0]?.name : dest?.name;
      const destinationSlug = Array.isArray(dest) ? dest[0]?.slug : dest?.slug;

      const activeOffer = offersByPackage.get(pkg.id);
      const offerPrice = activeOffer
        ? activeOffer.discount_percent
          ? pkg.base_price * (1 - activeOffer.discount_percent / 100)
          : activeOffer.discount_flat
          ? pkg.base_price - activeOffer.discount_flat
          : null
        : null;

      return {
        id: pkg.id,
        slug: pkg.slug,
        title: pkg.title,
        cover_image_url: pkg.cover_image_url,
        duration_days: pkg.duration_days,
        duration_nights: pkg.duration_nights,
        base_price: pkg.base_price,
        discount_price: offerPrice ?? pkg.discount_price,
        currency: pkg.currency,
        short_description: pkg.short_description,
        destinationName,
        destinationSlug,
        category: pkg.category,
        hasActiveOffer: Boolean(activeOffer),
        is_featured: (pkg as any).is_featured,
      };
    });

  return (
    <PackagesExplorer
      initialPackages={mappedPackages}
      destinations={destinations ?? []}
      initialCategory={searchParams.category ?? ''}
      initialDestination={searchParams.destination ?? ''}
      initialSearch={searchParams.search ?? searchParams.q ?? ''}
      pageContent={pageContent}
    />
  );
}
