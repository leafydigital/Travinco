'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
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
  const totalSlides = slides.length;

  const eyebrow = heroContent?.eyebrow || 'Explore Beyond Boundaries';
  const title = heroContent?.title || 'Discover Asia with us';
  const buttonText = heroContent?.button_text || 'Learn More';
  const buttonLink = heroContent?.button_link || '/packages';

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
      <div className="relative flex h-screen min-h-screen items-center justify-center bg-brand-900 text-white text-center px-4">
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
    <div className="relative h-screen min-h-screen w-full flex flex-col justify-center items-center overflow-hidden bg-navy-950 text-white select-none">
      {/* ── Background Slides with Smooth Crossfade & Ken Burns Zoom ── */}
      <div className="absolute inset-0 z-0">
        {slides.map((slide, idx) => {
          const isActive = idx === currentIndex;
          return (
            <div
              key={slide.id || idx}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              <div
                className={`relative h-full w-full transition-transform duration-[7500ms] ease-out ${
                  isActive ? 'scale-105' : 'scale-100'
                }`}
              >
                <Image
                  src={slide.imageUrl}
                  alt={slide.title || 'Travel destination'}
                  fill
                  priority={idx === 0}
                  className="object-cover object-center"
                  sizes="100vw"
                  quality={90}
                />
              </div>

              {/* Multi-layered Gradients for Deep Contrast & Pure White Text Readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-navy-950/90 via-navy-950/40 to-navy-950/60" />
              <div className="absolute inset-0 bg-black/40" />
            </div>
          );
        })}
      </div>

      {/* ── Centered Main Hero Text (Pure White, No AI Symbol) ── */}
      <div className="container-page relative z-20 text-center flex flex-col items-center justify-center px-4 pt-16">
        <p className="text-sm sm:text-base md:text-lg font-semibold tracking-widest uppercase text-white drop-shadow-md mb-4 sm:mb-6">
          {eyebrow}
        </p>

        <h1 className="font-display text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-white drop-shadow-2xl max-w-5xl leading-[1.08] uppercase">
          {title}
        </h1>

        <div className="pt-6 sm:pt-8">
          <Link
            href={buttonLink}
            className="btn-cta inline-flex items-center gap-2 px-9 py-4 text-base font-semibold shadow-2xl hover:shadow-coral-500/30 transition-all rounded-full"
          >
            <span>{buttonText}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
