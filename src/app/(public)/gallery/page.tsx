import { createClient } from '@/lib/supabase/server';
import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Gallery' };

export default async function GalleryPage() {
  const supabase = await createClient();
  const { data: images } = await supabase
    .from('gallery')
    .select('*')
    .eq('status', 'published')
    .order('sort_order');

  return (
    <div className="container-page py-12">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink-900">Gallery</h1>
        <p className="mt-2 text-ink-500">Moments from the trips we&apos;ve planned</p>
      </div>

      {(images ?? []).length === 0 ? (
        <p className="py-16 text-center text-ink-400">Gallery coming soon.</p>
      ) : (
        <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
          {(images ?? []).map((img) => (
            <div key={img.id} className="relative overflow-hidden rounded-xl2 break-inside-avoid">
              <Image
                src={img.image_url}
                alt={img.title ?? ''}
                width={400}
                height={400}
                className="w-full object-cover"
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
