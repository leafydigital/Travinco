'use client';

import { useState } from 'react';
import { Quote, Star, ShieldCheck } from 'lucide-react';
import type { TestimonialItem } from '@/lib/home-page-content-types';

interface TestimonialsCarouselProps {
  items: TestimonialItem[];
}

export function TestimonialsCarousel({ items }: TestimonialsCarouselProps) {
  const [isPaused, setIsPaused] = useState(false);

  if (!items || items.length === 0) return null;

  // Duplicate items enough times so the marquee is seamless across all viewports
  // A minimum of 8-12 cards ensures ultra-wide displays never see a gap
  const multiplier = Math.max(2, Math.ceil(12 / items.length));
  const fullList = Array.from({ length: multiplier }, () => items).flat();

  // Create two identical halves for the seamless 0% -> -50% loop
  const displayItems = [...fullList, ...fullList];

  const borders = [
    'border-t-brand-500',
    'border-t-coral-500',
    'border-t-ocean-500',
    'border-t-sand-500',
  ];

  // Calculate duration based on card count so scroll speed remains steady and readable
  const duration = Math.max(30, fullList.length * 5);

  return (
    <div className="relative w-full overflow-hidden select-none py-2">
      {/* ── Keyframes for smooth continuous hardware-accelerated scrolling ── */}
      <style>{`
        @keyframes testimonials-scroll-ltr {
          0% {
            transform: translate3d(-50%, 0, 0);
          }
          100% {
            transform: translate3d(0%, 0, 0);
          }
        }
      `}</style>

      {/* ── Gradient Fade Masks on Left & Right Edges for Premium Polish ── */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-20 w-12 sm:w-24 bg-gradient-to-r from-sand-50 via-sand-50/80 to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-20 w-12 sm:w-24 bg-gradient-to-l from-sand-50 via-sand-50/80 to-transparent" />

      {/* ── Continuous Auto-Scrolling Track (Left to Right) ── */}
      <div
        className="flex w-max gap-5 sm:gap-6 py-4 cursor-grab active:cursor-grabbing"
        style={{
          animation: `testimonials-scroll-ltr ${duration}s linear infinite`,
          animationPlayState: isPaused ? 'paused' : 'running',
          willChange: 'transform',
        }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {displayItems.map((t, idx) => {
          const borderClass = borders[idx % borders.length];
          return (
            <div
              key={`${t.name}-${idx}`}
              className="w-[300px] sm:w-[360px] lg:w-[400px] shrink-0 flex"
            >
              <div
                className={`card border-t-4 p-6 sm:p-7 bg-white shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between w-full rounded-2xl border-ink-100/80 hover:-translate-y-1 ${borderClass}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sand-50 text-sand-500 shadow-xs">
                      <Quote className="h-5 w-5" />
                    </div>
                    <div className="flex gap-0.5" aria-label={`${t.rating} out of 5 stars`}>
                      {Array.from({ length: 5 }).map((_, starIndex) => (
                        <Star
                          key={starIndex}
                          className={`h-4 w-4 ${
                            starIndex < t.rating ? 'fill-sand-400 text-sand-400' : 'text-ink-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-ink-700 italic leading-relaxed min-h-[72px]">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>

                <div className="mt-6 border-t border-ink-100 pt-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-ink-900">{t.name}</p>
                    <p className="text-xs text-brand-700 font-medium">{t.trip}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-sand-100/80 px-2.5 py-0.5 text-[10px] font-bold text-sand-800">
                    <ShieldCheck className="h-3 w-3 text-sand-600" />
                    <span>Verified Trip</span>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
