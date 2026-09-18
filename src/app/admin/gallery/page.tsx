import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { GalleryGrid } from './gallery-grid';
import { GalleryAddForm } from './gallery-add-form';

export default async function AdminGalleryPage() {
  await requireProfile();
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
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-ink-900">Gallery</h1>
      <GalleryAddForm existingCountries={existingCountries} existingCategories={existingCategories} />
      <GalleryGrid images={images ?? []} />
    </div>
  );
}
