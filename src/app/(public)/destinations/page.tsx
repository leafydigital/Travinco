import { createClient } from '@/lib/supabase/server';
import {
  DestinationsExplorer,
  type DestinationExplorerItem,
} from '@/components/public/destinations-explorer';
import { getDestinationsPageContent } from '@/lib/destinations-page-content';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Destinations | Handcrafted Holiday Regions & Sanctuaries',
  description:
    'Explore iconic travel destinations across Asia, each handpicked with bespoke itineraries, luxury boutique resorts, and private chauffeured tours.',
};

export default async function DestinationsPage({
  searchParams,
}: {
  searchParams: { search?: string; q?: string };
}) {
  const supabase = await createClient();

  const [
    { data: destinationsData },
    { data: deletedSettingsData },
    pageContent,
  ] = await Promise.all([
    supabase
      .from('destinations')
      .select(
        'id, name, slug, country, description, cover_image_url, is_featured, is_deleted, status, sort_order'
      )
      .eq('status', 'published')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase.from('website_settings').select('key').like('key', 'deleted_destination_%'),
    getDestinationsPageContent(),
  ]);

  const deletedKeys = new Set(
    (deletedSettingsData || []).map((s: { key: string }) => s.key.replace('deleted_destination_', ''))
  );

  // Guarantee that is_deleted true destinations NEVER show on customer side
  const mappedDestinations: DestinationExplorerItem[] = (destinationsData ?? [])
    .filter((d: any) => d.is_deleted !== true && !deletedKeys.has(d.id))
    .map((d: any) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      country: d.country,
      description: d.description,
      cover_image_url: d.cover_image_url,
      is_featured: Boolean(d.is_featured),
    }));

  return (
    <DestinationsExplorer
      initialDestinations={mappedDestinations}
      initialSearch={searchParams.search ?? searchParams.q ?? ''}
      pageContent={pageContent}
    />
  );
}
