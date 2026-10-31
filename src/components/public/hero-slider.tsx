'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { isVideoUrl } from '@/lib/media';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export interface HeroSlideItem {
  id: string;
  imageUrl: string;
  title?: string;
  subtitle?: string;
  badge?: string;
  location?: string;
  link?: string;
}

export interface HeroContentProps {
  eyebrow?: string;
  title?: string;
  button_text?: string;
  button_link?: string;
}

interface HeroSliderProps {
  slides: HeroSlideItem[];
  heroContent?: HeroContentProps;
}

export function HeroSlider({ slides, heroContent }: HeroSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const totalSlides = slides.length;

  const eyebrow = heroContent?.eyebrow || 'Explore Beyond Boundaries';
  const title = heroContent?.title || 'Discover Asia with us';
  const buttonText = heroContent?.button_text || 'Learn More';
  const buttonLink = heroContent?.button_link || '/packages';

  useEffect(() => {
    setMounted(true);
  }, []);

  const nextSlide = useCallback(() => {
    if (totalSlides === 0) return;
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  // Autoplay timer: auto-transitions every 5 seconds
  useEffect(() => {
    if (totalSlides <= 1) return;

    const timer = setInterval(() => {
      nextSlide();
    }, 5000);

    return () => clearInterval(timer);
  }, [nextSlide, totalSlides]);

  if (totalSlides === 0) {
    return (
      <div className="relative flex h-screen min-h-screen supports-[height:100svh]:h-[100svh] supports-[height:100svh]:min-h-[100svh] items-center justify-center bg-brand-900 text-white text-center px-4">
        <div className="space-y-4 max-w-4xl">
          <p className="text-sm sm:text-base font-semibold tracking-widest uppercase text-white">
            {eyebrow}
          </p>
          <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-bold text-white uppercase">
            {title}
          </h1>
          <div className="pt-6">
            <Link
              href={buttonLink}
              className="btn-cta inline-flex items-center gap-2 px-9 py-4 text-base font-semibold shadow-xl rounded-full"
            >
              <span>{buttonText}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen min-h-screen supports-[height:100svh]:h-[100svh] supports-[height:100svh]:min-h-[100svh] w-full flex flex-col justify-center items-center overflow-hidden bg-navy-950 text-white select-none">
      {/* ── Background Slides with Smooth Crossfade & Ken Burns Zoom ── */}
      <div className="absolute inset-0 z-0">
        {slides.map((slide, idx) => {
          const isActive = idx === currentIndex;
          // Prioritize first slide on initial paint to maximize speed; mount remaining slides smoothly
          const shouldRender = idx === 0 || mounted;
          if (!shouldRender) return null;

          return (
            <div
              key={slide.id || idx}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              <div
                className={`relative h-full w-full transform-gpu transition-transform duration-[7500ms] ease-out ${
                  isActive ? 'scale-105' : 'scale-100'
                }`}
              >
                {isVideoUrl(slide.imageUrl) ? (
                  // Hero slides may be videos (uploaded from Customize Theme): muted autoplay loop
                  <video
                    src={slide.imageUrl}
                    className="absolute inset-0 h-full w-full object-cover object-center brightness-[0.78] contrast-[1.05]"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload={idx === 0 ? 'auto' : 'metadata'}
                    aria-label={slide.title || 'Travel destination video'}
                  />
                ) : (
                  <Image
                    src={slide.imageUrl}
                    alt={slide.title || 'Travel destination'}
                    fill
                    priority={idx === 0}
                    loading={idx === 0 ? 'eager' : 'lazy'}
                    unoptimized
                    className="object-cover object-center brightness-[0.78] contrast-[1.05]"
                    sizes="100vw"
                  />
                )}
              </div>

              {/* Subtle tint to gently lower brightness so text is easily readable */}
              <div className="absolute inset-0 bg-black/20 pointer-events-none" />
            </div>
          );
        })}
      </div>

      {/* ── Centered Main Hero Text (Clean Pure White, No Shadow) ── */}
      <div className="container-page relative z-20 text-center flex flex-col items-center justify-center px-4 pt-16">
        <p className="text-sm sm:text-base md:text-lg font-semibold tracking-widest uppercase text-white mb-4 sm:mb-6">
          {eyebrow}
        </p>

        <h1 className="font-display text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-white max-w-5xl leading-[1.08] uppercase">
          {title}
        </h1>

        <div className="pt-6 sm:pt-8">
          <Link
            href={buttonLink}
            className="btn-cta inline-flex items-center gap-2 px-9 py-4 text-base font-semibold shadow-2xl hover:shadow-emerald-600/30 transition-all rounded-full"
          >
            <span>{buttonText}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
