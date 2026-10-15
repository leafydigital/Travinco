import { createClient } from '@/lib/supabase/server';
import { requireProfile, assertModulePermission } from '@/lib/supabase/auth-helpers';
import Link from 'next/link';
import { Plus, ArrowLeft } from 'lucide-react';
import { PackagesTable, type PackageItem } from './packages-table';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminPackagesPage() {
  const profile = await requireProfile();
  await assertModulePermission(profile, 'packages', 'view');

  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
  const supabase = await createClient();

  // Fetch all packages and destinations concurrently in parallel (sub-50ms)
  // Fetch all packages, destinations, and soft-deleted markers concurrently in parallel
  const [
    { data: packagesData, error: packagesError },
    { data: destinationsData },
    { data: deletedSettingsData },
  ] = await Promise.all([
    supabase
      .from('travel_packages')
      .select(
        'id, title, slug, status, base_price, discount_price, currency, duration_days, duration_nights, cover_image_url, is_featured, destination_id, is_deleted'
      )
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('destinations').select('id, name'),
    supabase.from('website_settings').select('key').like('key', 'deleted_package_%'),
  ]);

  let pkgs: any[] | null = packagesData;
  if (packagesError && packagesError.message?.includes('is_deleted')) {
    const fallback = await supabase
      .from('travel_packages')
      .select(
        'id, title, slug, status, base_price, discount_price, currency, duration_days, duration_nights, cover_image_url, is_featured, destination_id'
      )
      .order('created_at', { ascending: false })
      .limit(100);
    pkgs = fallback.data;
  } else if (packagesError) {
    console.error('Error fetching travel packages:', packagesError);
  }

  const deletedKeys = new Set(
    (deletedSettingsData || []).map((s: { key: string }) => s.key.replace('deleted_package_', ''))
  );

  const destinationsMap: Record<string, string> = {};
  (destinationsData ?? []).forEach((d: { id: string; name: string }) => {
    destinationsMap[d.id] = d.name;
  });

  // Filter out packages that are soft-deleted (either via is_deleted column or fallback marker)
  const activePackages: PackageItem[] = (pkgs ?? [])
    .filter((pkg: any) => pkg.is_deleted !== true && !deletedKeys.has(pkg.id))
    .map((pkg: any) => ({
      id: pkg.id,
      title: pkg.title,
      slug: pkg.slug,
      status: pkg.status,
      base_price: Number(pkg.base_price) || 0,
      discount_price: pkg.discount_price ? Number(pkg.discount_price) : null,
      currency: pkg.currency || 'INR',
      duration_days: pkg.duration_days,
      duration_nights: pkg.duration_nights,
      cover_image_url: pkg.cover_image_url,
      is_featured: Boolean(pkg.is_featured),
      destination_id: pkg.destination_id,
      is_deleted: pkg.is_deleted,
    }));

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-100 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Link
              href="/travinco_dashboard"
              className="inline-flex items-center gap-1 text-xs font-medium text-ink-400 hover:text-brand-700 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Dashboard</span>
            </Link>
          </div>

          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
              Travel Packages
            </h1>
            <span className="rounded-md bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-600">
              {activePackages.length} package{activePackages.length !== 1 ? 's' : ''}
            </span>
          </div>

          <p className="text-sm text-ink-500 max-w-2xl leading-relaxed">
            Curate, publish, and manage tour package listings, pricing, duration, and detailed itineraries across all destinations.
          </p>
        </div>

        <Link
          href="/travinco_dashboard/packages/new"
          prefetch={true}
          className="btn-primary inline-flex items-center gap-2 shadow-2xs hover:shadow-xs transition"
        >
          <Plus className="h-4 w-4" />
          <span>New package</span>
        </Link>
      </div>

      {/* 2. Instant Client-Side Table (0ms search and filter latency) */}
      <PackagesTable
        initialPackages={activePackages}
        destinationsMap={destinationsMap}
        isAdmin={isAdmin}
      />
    </div>
  );
}
