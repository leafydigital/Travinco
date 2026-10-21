'use client';

import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import type { AboutFaqItem } from '@/lib/about-page-content-types';

interface AboutFaqAccordionProps {
  items: AboutFaqItem[];
}

export function AboutFaqAccordion({ items }: AboutFaqAccordionProps) {
  // First item open by default for rich instant visibility
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-3.5">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={index}
            className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
              isOpen
                ? 'bg-white border-brand-300 shadow-md ring-1 ring-brand-100'
                : 'bg-white/80 hover:bg-white border-ink-200/80 shadow-xs hover:border-ink-300'
            }`}
          >
            <button
              type="button"
              onClick={() => toggle(index)}
              className="flex w-full items-center justify-between gap-4 p-5 sm:p-6 text-left cursor-pointer transition-colors"
              aria-expanded={isOpen}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 transition-colors ${
                    isOpen
                      ? 'bg-brand-50 text-brand-600'
                      : 'bg-ink-100/70 text-ink-500'
                  }`}
                >
                  <HelpCircle className="h-4 w-4" />
                </div>
                <span className="font-display text-sm sm:text-base font-bold text-ink-950 leading-snug">
                  {item.question}
                </span>
              </div>

              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 transition-all duration-200 ${
                  isOpen
                    ? 'bg-brand-50 text-brand-600 rotate-180'
                    : 'bg-ink-50 text-ink-500 hover:bg-ink-100'
                }`}
              >
                <ChevronDown className="h-4 w-4" />
              </div>
            </button>

            {isOpen && (
              <div className="px-5 pb-6 sm:px-6 sm:pb-6 pt-0 animate-in fade-in-50 duration-200">
                <div className="pl-11.5 border-t border-ink-100/80 pt-4">
                  <p className="text-xs sm:text-sm text-ink-700 leading-relaxed font-normal">
                    {item.answer}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
