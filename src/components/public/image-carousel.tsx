'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X, Maximize2 } from 'lucide-react';

export type CarouselImage = { url: string; alt: string };

/**
 * ImageCarousel with compact, small-width lightbox dialog modal.
 * - Displays a row of photos with previous/next shifting buttons.
 * - Clicking any photo opens a centered small-width modal with ZERO delay.
 * - Inside the modal, users can navigate left & right (arrow buttons, keyboard, touch swipe, thumbnails)
 *   and close easily (X button, Esc key, backdrop click).
 */
export function ImageCarousel({
  images,
  visibleCount = 3,
}: {
  images: CarouselImage[];
  visibleCount?: number;
}) {
  const [startIndex, setStartIndex] = useState(0);
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // Client-side mount flag for createPortal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Preload all gallery images immediately in the background so opening & flipping has 0 delay
  useEffect(() => {
    if (typeof window === 'undefined' || !images || images.length === 0) return;
    images.forEach((img) => {
      if (img?.url) {
        const preloader = new window.Image();
        preloader.src = img.url;
      }
    });
  }, [images]);

  const handleNextModal = useCallback(() => {
    if (!images || images.length === 0) return;
    setModalIndex((current) => (current === null ? 0 : (current + 1) % images.length));
  }, [images]);

  const handlePrevModal = useCallback(() => {
    if (!images || images.length === 0) return;
    setModalIndex((current) => (current === null ? 0 : (current - 1 + images.length) % images.length));
  }, [images]);

  const handleCloseModal = useCallback(() => {
    setModalIndex(null);
  }, []);

  // Keyboard navigation & lock background scroll when modal is active
  useEffect(() => {
    if (modalIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseModal();
      } else if (e.key === 'ArrowRight') {
        handleNextModal();
      } else if (e.key === 'ArrowLeft') {
        handlePrevModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [modalIndex, handleCloseModal, handleNextModal, handlePrevModal]);

  if (!images || images.length === 0) return null;

  function shift(direction: -1 | 1) {
    setStartIndex((i) => (i + direction + images.length) % images.length);
  }

  const visible = Array.from({ length: Math.min(visibleCount, images.length) }, (_, i) => {
    const idx = (startIndex + i) % images.length;
    const img = images[idx];
    return img ? { ...img, key: idx, originalIndex: idx } : null;
  }).filter((img): img is CarouselImage & { key: number; originalIndex: number } => img !== null);

  const activeModalImage = modalIndex !== null ? images[modalIndex] : null;

  // Touch swipe support for mobile inside modal
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0]?.clientX ?? null;
    if (touchEndX === null) return;

    const diff = touchEndX - touchStartX.current;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        handlePrevModal();
      } else {
        handleNextModal();
      }
    }
    touchStartX.current = null;
  };

  return (
    <div className="relative">
      {/* ── Carousel Cards Grid ── */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((img) => (
          <div
            key={img.key}
            onClick={() => setModalIndex(img.originalIndex)}
            className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-ink-100 cursor-pointer shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setModalIndex(img.originalIndex);
              }
            }}
            aria-label={`View photo: ${img.alt || 'Traveler moment'}`}
          >
            <Image
              src={img.url}
              alt={img.alt}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            />
            {/* Hover overlay hint */}
            <div className="absolute inset-0 bg-navy-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-xs text-xs font-semibold text-ink-900 shadow-md">
                <Maximize2 className="h-3.5 w-3.5 text-brand-600" />
                <span>View Photo</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Outer Left / Right Carousel Controls ── */}
      {images.length > visibleCount && (
        <>
          <button
            type="button"
            onClick={() => shift(-1)}
            className="absolute -left-3 sm:-left-5 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white text-ink-800 shadow-md border border-ink-100 hover:bg-ink-50 hover:scale-105 transition cursor-pointer focus:outline-hidden"
            aria-label="Previous images"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            className="absolute -right-3 sm:-right-5 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white text-ink-800 shadow-md border border-ink-100 hover:bg-ink-50 hover:scale-105 transition cursor-pointer focus:outline-hidden"
            aria-label="Next images"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* ── Small-Width Centered Lightbox Modal Dialog ── */}
      {mounted &&
        modalIndex !== null &&
        activeModalImage &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-150 backdrop-blur-xs"
            style={{ backgroundColor: 'rgba(8, 13, 26, 0.78)' }}
            onClick={handleCloseModal}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            role="dialog"
            aria-modal="true"
            aria-label="Photo Preview Dialog"
          >
            {/* Modal Box: Compact width (max-w-xl / ~576px) */}
            <div
              className="relative w-full max-w-lg sm:max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-ink-100/80 animate-in zoom-in-95 duration-150 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Bar */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-ink-100 bg-sand-50/50">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-brand-50 border border-brand-200/60 px-2.5 py-0.5 text-[11px] font-bold text-brand-800">
                    Photo {modalIndex + 1} of {images.length}
                  </span>
                  <span className="text-xs font-semibold text-ink-600 truncate max-w-[200px] sm:max-w-xs">
                    Captured On The Road
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-ink-600 hover:bg-ink-200 hover:text-ink-900 transition cursor-pointer focus:outline-hidden"
                  aria-label="Close dialog"
                  title="Close (Esc)"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Photo Area with Left/Right Navigation Arrows */}
              <div className="relative aspect-[4/3] w-full bg-navy-950 overflow-hidden">
                <Image
                  src={activeModalImage.url}
                  alt={activeModalImage.alt || 'Captured on the road'}
                  fill
                  unoptimized
                  className="object-cover select-none transition-all duration-200"
                  priority
                />

                {/* Left Navigation Arrow */}
                {images.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrevModal();
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-xs hover:bg-black/85 hover:scale-105 active:scale-95 transition cursor-pointer focus:outline-hidden"
                    aria-label="Previous photo"
                    title="Previous photo (Left Arrow)"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}

                {/* Right Navigation Arrow */}
                {images.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNextModal();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-xs hover:bg-black/85 hover:scale-105 active:scale-95 transition cursor-pointer focus:outline-hidden"
                    aria-label="Next photo"
                    title="Next photo (Right Arrow)"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                )}
              </div>

              {/* Footer Area: Caption & Thumbnail Strip */}
              <div className="p-4 sm:p-5 bg-white space-y-3">
                {activeModalImage.alt && (
                  <p className="text-xs sm:text-sm font-semibold text-ink-900 text-center">
                    {activeModalImage.alt}
                  </p>
                )}

                {/* Thumbnails to jump directly */}
                {images.length > 1 && (
                  <div className="flex items-center justify-center gap-2 overflow-x-auto py-1">
                    {images.map((img, idx) => {
                      const isActive = idx === modalIndex;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setModalIndex(idx)}
                          className={`relative h-11 w-16 shrink-0 overflow-hidden rounded-lg transition-all cursor-pointer ${
                            isActive
                              ? 'ring-2 ring-brand-600 scale-105 opacity-100 shadow-xs'
                              : 'opacity-50 hover:opacity-85 hover:scale-100'
                          }`}
                          aria-label={`Jump to photo ${idx + 1}`}
                        >
                          <Image
                            src={img.url}
                            alt={img.alt || `Thumbnail ${idx + 1}`}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
