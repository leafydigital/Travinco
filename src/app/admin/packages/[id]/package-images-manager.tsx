'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Image from 'next/image';
import { X, Star, Plus, ArrowUp, ArrowDown } from 'lucide-react';
import { addPackageImage, removePackageImage, setCoverImage, reorderPackageImage } from '../sub-resource-actions';
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

  function makeCover(id: string, imageUrl: string) {
    startTransition(async () => {
      const result = await setCoverImage(packageId, id, imageUrl);
      if (result.error) toast.error(result.error);
      router.refresh();
    });
  }

  function move(id: string, direction: 'up' | 'down') {
    startTransition(async () => {
      const result = await reorderPackageImage(packageId, id, direction);
      if (result.error) toast.error(result.error);
      router.refresh();
    });
  }

  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-400">
        Paste an image URL from your Supabase Storage bucket (or any public image host). Use the
        arrows to reorder, the star to set the cover image shown on the public site.
      </p>

      {sorted.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sorted.map((img, i) => (
            <div key={img.id} className="group relative aspect-video overflow-hidden rounded-lg border border-ink-100">
              <Image src={img.image_url} alt={img.alt_text ?? ''} fill className="object-cover" unoptimized />
              {img.is_cover && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-brand-600 p-1 text-white">
                  <Star className="h-3 w-3 fill-current" />
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-navy-900/80 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(img.id, 'up')}
                    disabled={isPending || i === 0}
                    className="rounded-full bg-white/90 p-1 text-ink-700 disabled:opacity-40"
                    aria-label="Move earlier"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(img.id, 'down')}
                    disabled={isPending || i === sorted.length - 1}
                    className="rounded-full bg-white/90 p-1 text-ink-700 disabled:opacity-40"
                    aria-label="Move later"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                  {!img.is_cover && (
                    <button
                      type="button"
                      onClick={() => makeCover(img.id, img.image_url)}
                      disabled={isPending}
                      className="rounded-full bg-white/90 p-1 text-sand-700"
                      aria-label="Set as cover"
                    >
                      <Star className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remove(img.id)}
                  disabled={isPending}
                  className="rounded-full bg-coral-600 p-1 text-white"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
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
