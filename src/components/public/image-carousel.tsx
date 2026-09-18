'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type CarouselImage = { url: string; alt: string };

/**
 * Shows a window of images side by side (3 on desktop, fewer on smaller
 * screens via CSS) with left/right arrows that shift the window by one
 * image at a time and wrap around at the ends.
 */
export function ImageCarousel({
  images,
  visibleCount = 3,
}: {
  images: CarouselImage[];
  visibleCount?: number;
}) {
  const [startIndex, setStartIndex] = useState(0);

  if (images.length === 0) return null;

  function shift(direction: -1 | 1) {
    setStartIndex((i) => (i + direction + images.length) % images.length);
  }

  // Build the visible window, wrapping around the end of the array.
  // images[idx] is always in-bounds here (idx comes from a modulo
  // against images.length, and we've already returned early if the
  // array is empty), but TypeScript can't infer that from a plain
  // index access — this filters out the type-only "undefined" case
  // without changing any real runtime behavior.
  const visible = Array.from({ length: Math.min(visibleCount, images.length) }, (_, i) => {
    const idx = (startIndex + i) % images.length;
    const img = images[idx];
    return img ? { ...img, key: idx } : null;
  }).filter((img): img is CarouselImage & { key: number } => img !== null);

  return (
    <div className="relative">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((img) => (
          <div key={img.key} className="relative aspect-[4/3] overflow-hidden rounded-xl2 bg-ink-100">
            <Image
              src={img.url}
              alt={img.alt}
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            />
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => shift(-1)}
            className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-2 text-ink-700 shadow-lg hover:bg-ink-50"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            className="absolute right-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-2 text-ink-700 shadow-lg hover:bg-ink-50"
            aria-label="Next image"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}
