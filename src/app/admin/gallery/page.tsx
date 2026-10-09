import { createClient } from '@/lib/supabase/server';
import { requireProfile, assertModulePermission } from '@/lib/supabase/auth-helpers';
import { GalleryGrid } from './gallery-grid';
import { GalleryAddForm } from './gallery-add-form';
import { Suspense } from 'react';

/* ── data (streamed) ──────────────────────────────────────── */
async function GalleryContent() {
  const profile = await requireProfile();
  await assertModulePermission(profile, 'gallery', 'view');
  const supabase = await createClient();
  const { data: images } = await supabase
    .from('gallery')
    .select('*')
    .order('country', { ascending: true })
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true });

  const existingCountries = Array.from(
    new Set((images ?? []).map((img) => img.country).filter((c): c is string => Boolean(c)))
  ).sort();
  const existingCategories = Array.from(
    new Set((images ?? []).map((img) => img.category).filter((c): c is string => Boolean(c)))
  ).sort();

  return (
    <>
      <GalleryAddForm existingCountries={existingCountries} existingCategories={existingCategories} />
      <GalleryGrid images={images ?? []} />
    </>
  );
}

/* ── page shell (instant) ─────────────────────────────────── */
export default function AdminGalleryPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-ink-900">Gallery</h1>
      <Suspense fallback={
        <div className="space-y-5">
          <div className="card h-24 animate-pulse bg-ink-100" />
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-lg bg-ink-100" />
            ))}
          </div>
        </div>
      }>
        <GalleryContent />
      </Suspense>
    </div>
  );
}
