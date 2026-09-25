import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { notFound } from 'next/navigation';
import { PackageForm } from '../package-form';
import { ItineraryManager } from './itinerary-manager';
import { InclusionExclusionManager } from './inclusion-exclusion-manager';
import {
  addInclusion, addInclusionsBulk, updateInclusion, removeInclusion,
  addExclusion, addExclusionsBulk, updateExclusion, removeExclusion,
} from '../sub-resource-actions';
import { PackageImagesManager } from './package-images-manager';
import { PackageVideosManager } from './package-videos-manager';
import { StatusBadge } from '@/components/ui/status-badge';
import Link from 'next/link';

export default async function EditPackagePage({ params }: { params: { id: string } }) {
  await requireProfile();
  const supabase = await createClient();

  const [
    { data: pkg },
    { data: destinations },
    { data: itinerary },
    { data: inclusions },
    { data: exclusions },
    { data: images },
    { data: videos },
  ] = await Promise.all([
      supabase.from('travel_packages').select('*').eq('id', params.id).single(),
      supabase.from('destinations').select('id, name').order('name'),
      supabase
        .from('package_itineraries')
        .select('*')
        .eq('package_id', params.id)
        .order('day_number'),
      supabase
        .from('package_inclusions')
        .select('*')
        .eq('package_id', params.id)
        .order('sort_order'),
      supabase
        .from('package_exclusions')
        .select('*')
        .eq('package_id', params.id)
        .order('sort_order'),
      supabase
        .from('package_images')
        .select('*')
        .eq('package_id', params.id)
        .order('sort_order'),
      supabase
        .from('package_videos')
        .select('*')
        .eq('package_id', params.id)
        .order('sort_order'),
    ]);

  if (!pkg) notFound();

  return (
    <div className="max-w-3xl space-y-8 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-ink-900">{pkg.title}</h1>
            <StatusBadge status={pkg.status} />
          </div>
          <p className="text-sm text-ink-500">/packages/{pkg.slug}</p>
        </div>
        <Link href="/admin/packages" className="btn-outline">
          Back to packages
        </Link>
      </div>

      <PackageForm
        destinations={destinations ?? []}
        packageId={pkg.id}
        currentStatus={pkg.status}
        initialValues={{
          destination_id: pkg.destination_id,
          title: pkg.title,
          slug: pkg.slug,
          category: pkg.category,
          duration_days: pkg.duration_days,
          duration_nights: pkg.duration_nights,
          base_price: pkg.base_price,
          discount_price: pkg.discount_price,
          currency: pkg.currency,
          short_description: pkg.short_description,
          full_description: pkg.full_description,
          highlights: pkg.highlights,
          available_from: pkg.available_from,
          available_to: pkg.available_to,
          total_seats: pkg.total_seats,
          pickup_info: pkg.pickup_info,
          is_featured: pkg.is_featured,
          meta_title: pkg.meta_title,
          meta_description: pkg.meta_description,
        }}
      />

      <div className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-ink-800">Day-by-day itinerary</h2>
        <ItineraryManager packageId={pkg.id} days={itinerary ?? []} />
      </div>

      <div className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-ink-800">Inclusions</h2>
        <InclusionExclusionManager
          packageId={pkg.id}
          items={inclusions ?? []}
          onAdd={addInclusion}
          onAddBulk={addInclusionsBulk}
          onUpdate={updateInclusion}
          onRemove={removeInclusion}
          label="What's included"
        />
      </div>

      <div className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-ink-800">Exclusions</h2>
        <InclusionExclusionManager
          packageId={pkg.id}
          items={exclusions ?? []}
          onAdd={addExclusion}
          onAddBulk={addExclusionsBulk}
          onUpdate={updateExclusion}
          onRemove={removeExclusion}
          label="What's not included"
        />
      </div>

      <div className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-ink-800">Gallery images</h2>
        <PackageImagesManager packageId={pkg.id} images={images ?? []} />
      </div>

      <div className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-ink-800">Videos</h2>
        <PackageVideosManager packageId={pkg.id} videos={videos ?? []} />
      </div>

      {/* Triggers PackageForm's own submit via the form="package-form"
          link — same save logic, just visually last on the page, to
          match the create page where the button is naturally the last
          element. The itinerary/inclusions/exclusions/images/videos
          managers above each save independently as you use them; this
          button only saves the basic-info fields further up. */}
      <div className="flex justify-end">
        <button type="submit" form="package-form" className="btn-primary">
          Save changes
        </button>
      </div>
    </div>
  );
}
