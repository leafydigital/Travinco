'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Image from 'next/image';
import { X, Star, Plus } from 'lucide-react';
import { addPackageImage, removePackageImage } from '../sub-resource-actions';
import type { Tables } from '@/types/database';

export function PackageImagesManager({
  packageId,
  images,
}: {
  packageId: string;
  images: Tables<'package_images'>[];
}) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [isPending, startTransition] = useTransition();

  function add(isCover: boolean) {
    if (!url.trim()) return;
    startTransition(async () => {
      const result = await addPackageImage(packageId, url.trim(), isCover);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setUrl('');
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await removePackageImage(packageId, id);
      if (result.error) toast.error(result.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-400">
        Paste an image URL from your Supabase Storage bucket (or any public image host). Direct
        file upload from this screen is wired up in the storage phase — see README for the
        Supabase Storage bucket setup.
      </p>

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img) => (
            <div key={img.id} className="group relative aspect-video overflow-hidden rounded-lg border border-ink-100">
              <Image src={img.image_url} alt={img.alt_text ?? ''} fill className="object-cover" unoptimized />
              {img.is_cover && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-brand-600 p-1 text-white">
                  <Star className="h-3 w-3 fill-current" />
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(img.id)}
                className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remove image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="input flex-1 min-w-[220px]"
        />
        <button type="button" onClick={() => add(false)} disabled={isPending} className="btn-outline">
          <Plus className="h-4 w-4" /> Add
        </button>
        <button type="button" onClick={() => add(true)} disabled={isPending} className="btn-secondary">
          <Star className="h-4 w-4" /> Add as cover
        </button>
      </div>
    </div>
  );
}
