'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Image from 'next/image';
import { Trash2 } from 'lucide-react';
import { setGalleryImageStatus, deleteGalleryImage } from '../content-actions';
import type { Tables, ContentStatus } from '@/types/database';

export function GalleryGrid({ images }: { images: Tables<'gallery'>[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggleStatus(id: string, current: ContentStatus) {
    const next: ContentStatus = current === 'published' ? 'archived' : 'published';
    startTransition(async () => {
      const result = await setGalleryImageStatus(id, next);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm('Delete this image?')) return;
    startTransition(async () => {
      const result = await deleteGalleryImage(id);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  }

  if (images.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-400">No gallery images yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {images.map((img) => (
        <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl2 border border-ink-100">
          <Image src={img.image_url} alt={img.title ?? ''} fill className="object-cover" unoptimized />
          <div className="absolute inset-0 flex flex-col justify-between bg-black/0 p-2 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
            <div className="flex justify-end">
              <button
                onClick={() => remove(img.id)}
                disabled={isPending}
                className="rounded-full bg-white/90 p-1.5 text-red-600"
                aria-label="Delete image"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              onClick={() => toggleStatus(img.id, img.status)}
              disabled={isPending}
              className="rounded-lg bg-white/90 px-2 py-1 text-xs font-medium text-ink-700"
            >
              {img.status === 'published' ? 'Unpublish' : 'Publish'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
