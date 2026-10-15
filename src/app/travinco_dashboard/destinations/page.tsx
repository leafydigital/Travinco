import { createClient } from '@/lib/supabase/server';
import { requireProfile, assertModulePermission } from '@/lib/supabase/auth-helpers';
import Link from 'next/link';
import { Plus, ArrowLeft } from 'lucide-react';
import { DestinationsTable, type DestinationItem } from './destinations-table';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminDestinationsPage() {
  const profile = await requireProfile();
  await assertModulePermission(profile, 'destinations', 'view');

  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
  const supabase = await createClient();

  // Fetch destinations and soft-deleted markers in parallel
  const [
    { data: destinationsData, error: destinationsError },
    { data: deletedSettingsData },
  ] = await Promise.all([
    supabase
      .from('destinations')
      .select('id, name, slug, country, description, cover_image_url, is_featured, status, sort_order')
      .order('sort_order', { ascending: true }),
    supabase.from('website_settings').select('key').like('key', 'deleted_destination_%'),
  ]);

  if (destinationsError) {
    console.error('Error fetching destinations:', destinationsError);
  }

  const deletedKeys = new Set(
    (deletedSettingsData || []).map((s: { key: string }) => s.key.replace('deleted_destination_', ''))
  );

  const activeDestinations: DestinationItem[] = (destinationsData ?? [])
    .filter((d: any) => d.is_deleted !== true && !deletedKeys.has(d.id))
    .map((d: any) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      country: d.country,
      description: d.description,
      cover_image_url: d.cover_image_url,
      is_featured: Boolean(d.is_featured),
      status: d.status,
      is_active: d.status === 'published',
    }));

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header with Breadcrumb, Title, Count, and Action */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-100 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Link
              href="/travinco_dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-brand-700 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Dashboard</span>
            </Link>
          </div>

          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
              Destinations
            </h1>
            <span className="rounded-md bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-600">
              {activeDestinations.length} destination{activeDestinations.length !== 1 ? 's' : ''}
            </span>
          </div>

          <p className="text-sm text-ink-500 max-w-2xl leading-relaxed">
            Curate popular travel destinations, regional descriptions, cover visuals, and publishing status.
          </p>
        </div>

        <Link
          href="/travinco_dashboard/destinations/new"
          prefetch={true}
          className="btn-primary inline-flex items-center gap-2 shadow-2xs hover:shadow-xs transition"
        >
          <Plus className="h-4 w-4" />
          <span>New destination</span>
        </Link>
      </div>

      {/* 2. Client-Side Instant Table with In-Memory Search & Status Filter */}
      <DestinationsTable
        initialDestinations={activeDestinations}
        isAdmin={isAdmin}
      />
    </div>
  );
}
