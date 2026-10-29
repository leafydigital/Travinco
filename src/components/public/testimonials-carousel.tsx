'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Quote, Star, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import type { TestimonialItem } from '@/lib/home-page-content-types';

interface TestimonialsCarouselProps {
  items: TestimonialItem[];
}

// Auto-scroll speed in pixels per second (cards travel right → left)
const SPEED_PX_PER_SEC = 40;

export function TestimonialsCarousel({ items }: TestimonialsCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, force] = useState(0);

  // Duplicate items enough times so the loop is seamless across all viewports
  const safeItems = items ?? [];
  const multiplier = safeItems.length ? Math.max(2, Math.ceil(12 / safeItems.length)) : 0;
  const fullList = Array.from({ length: multiplier }, () => safeItems).flat();
  // Two identical halves → wrap scrollLeft by half the width for an endless loop
  const displayItems = [...fullList, ...fullList];

  const wrap = useCallback((el: HTMLDivElement) => {
    const half = el.scrollWidth / 2;
    if (half <= 0) return;
    if (el.scrollLeft >= half) el.scrollLeft -= half;
    else if (el.scrollLeft <= 0) el.scrollLeft += half;
  }, []);

  // Continuous right → left auto scroll
  useEffect(() => {
    const el = trackRef.current;
    if (!el || displayItems.length === 0) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    // Start a little in so the first backward nav click has room
    el.scrollLeft = 1;
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      if (!pausedRef.current && !reduce) {
        acc += (SPEED_PX_PER_SEC * dt) / 1000;
        if (acc >= 1) {
          const whole = Math.floor(acc);
          el.scrollLeft += whole;
          acc -= whole;
          wrap(el);
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [displayItems.length, wrap]);

  useEffect(() => () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  }, []);

  const pause = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    pausedRef.current = true;
  };
  const resumeSoon = (ms = 400) => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      pausedRef.current = false;
      force((n) => n + 1);
    }, ms);
  };

  const go = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    pause();
    const card = el.querySelector<HTMLElement>('[data-card]');
    const gap = parseFloat(getComputedStyle(el.firstElementChild as Element).columnGap || '24') || 24;
    const amount = (card?.offsetWidth ?? 360) + gap;
    // Make sure there's room to move in the requested direction before animating
    const half = el.scrollWidth / 2;
    if (dir === -1 && el.scrollLeft < amount) el.scrollLeft += half;
    if (dir === 1 && el.scrollLeft >= half) el.scrollLeft -= half;
    el.scrollBy({ left: dir * amount, behavior: 'smooth' });
    resumeSoon(2500);
  };

  if (safeItems.length === 0) return null;

  const borders = [
    'border-t-brand-500',
    'border-t-emerald-500',
    'border-t-ocean-500',
    'border-t-sand-500',
  ];

  return (
    <div
      className="relative w-full select-none py-2"
      onMouseEnter={pause}
      onMouseLeave={() => resumeSoon(200)}
    >
      {/* ── Gradient Fade Masks on Left & Right Edges ── */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-12 sm:w-24 bg-gradient-to-r from-sand-50 via-sand-50/80 to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-12 sm:w-24 bg-gradient-to-l from-sand-50 via-sand-50/80 to-transparent" />

      {/* ── Navigation buttons ── */}
      <button
        type="button"
        aria-label="Previous testimonial"
        onClick={() => go(-1)}
        className="absolute left-1 sm:left-3 top-1/2 z-20 -translate-y-1/2 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-white text-ink-800 shadow-lg ring-1 ring-ink-100 transition hover:bg-brand-600 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="Next testimonial"
        onClick={() => go(1)}
        className="absolute right-1 sm:right-3 top-1/2 z-20 -translate-y-1/2 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-white text-ink-800 shadow-lg ring-1 ring-ink-100 transition hover:bg-brand-600 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* ── Scrolling track (right → left) ── */}
      <div
        ref={trackRef}
        className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onTouchStart={pause}
        onTouchEnd={() => resumeSoon(2500)}
      >
        <div className="flex w-max gap-5 sm:gap-6 py-4">
          {displayItems.map((t, idx) => {
            const borderClass = borders[idx % borders.length];
            return (
              <div
                key={`${t.name}-${idx}`}
                data-card
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
    </div>
  );
}
