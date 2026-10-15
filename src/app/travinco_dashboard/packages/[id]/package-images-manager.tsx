'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Image from 'next/image';
import { X, Star, ArrowUp, ArrowDown } from 'lucide-react';
import { addPackageImage, removePackageImage, setCoverImage, reorderPackageImage } from '../sub-resource-actions';
import { uploadPackageImage } from '../upload-actions';
import type { Tables } from '@/types/database';

export function PackageImagesManager({
  packageId,
  images,
}: {
  packageId: string;
  images: Tables<'package_images'>[];
}) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setIsUploading(true);
    let addedCount = 0;
    for (const file of files) {
      const formData = new FormData();
      formData.set('file', file);
      const uploadResult = await uploadPackageImage(formData);
      if (uploadResult.error) {
        toast.error(`${file.name}: ${uploadResult.error}`);
        continue;
      }
      if (uploadResult.url) {
        const saveResult = await addPackageImage(packageId, uploadResult.url, false);
        if (saveResult.error) toast.error(saveResult.error);
        else addedCount += 1;
      }
    }
    setIsUploading(false);
    e.target.value = '';
    if (addedCount > 0) {
      toast.success(addedCount === 1 ? 'Image uploaded' : `${addedCount} images uploaded`);
      router.refresh();
    }
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
        Upload JPG, PNG or WEBP photos directly — select multiple files at once to add several
        together. Use the arrows to reorder, the star to set the cover image shown on the public
        site.
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

      <div>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileSelect}
          disabled={isUploading}
          className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
        />
        {isUploading && <p className="mt-1.5 text-xs text-brand-600">Uploading…</p>}
      </div>
    </div>
  );
}
