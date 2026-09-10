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
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-ink-900">Gallery</h1>
      <GalleryAddForm />
      <GalleryGrid images={images ?? []} />
    </div>
  );
}
