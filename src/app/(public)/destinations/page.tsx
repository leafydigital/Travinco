import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import {
  DestinationsExplorer,
  type DestinationExplorerItem,
} from '@/components/public/destinations-explorer';
import { getDestinationsPageContent } from '@/lib/destinations-page-content';
import { getPageTitlesContent } from '@/lib/page-titles-content';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const titlesContent = await getPageTitlesContent();
  const title = titlesContent.titles?.destinations || 'Destinations | Handcrafted Holiday Regions & Sanctuaries';
  return {
    title: { absolute: title },
    description:
      'Explore iconic travel destinations across Asia, each handpicked with bespoke itineraries, luxury boutique resorts, and private chauffeured tours.',
  };
}

async function DestinationsDataSection({
  pageContent,
  initialSearch,
}: {
  pageContent: any;
  initialSearch: string;
}) {
  const supabase = await createClient();

  const [
    { data: destinationsData },
    { data: deletedSettingsData },
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
  ]);

  const deletedKeys = new Set(
    (deletedSettingsData || []).map((s: { key: string }) => s.key.replace('deleted_destination_', ''))
  );

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
      initialSearch={initialSearch}
      pageContent={pageContent}
      isLoading={false}
    />
  );
}

export default async function DestinationsPage({
  searchParams,
}: {
  searchParams: { search?: string; q?: string };
}) {
  const pageContent = await getDestinationsPageContent();
  const initialSearch = searchParams.search ?? searchParams.q ?? '';

  return (
    <Suspense
      fallback={
        <DestinationsExplorer
          initialDestinations={[]}
          initialSearch={initialSearch}
          pageContent={pageContent}
          isLoading={true}
        />
      }
    >
      <DestinationsDataSection pageContent={pageContent} initialSearch={initialSearch} />
    </Suspense>
  );
}
