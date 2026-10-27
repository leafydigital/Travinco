'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Clock,
  MapPin,
  Users,
  Check,
  X,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Calendar,
  Utensils,
  Hotel,
  Car,
  HelpCircle,
  FileText,
  Info,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { ImageLightbox } from '@/components/public/image-lightbox';
import { ExpandableText } from '@/components/public/expandable-text';

export interface PackageDetailViewProps {
  pkg: {
    id: string;
    title: string;
    slug: string;
    duration_days: number;
    duration_nights: number;
    base_price: number;
    discount_price: number | null;
    currency: string;
    full_description: string | null;
    short_description: string | null;
    highlights: string[];
    total_seats: number | null;
    category?: string | null;
  };
  destination?: { name: string; country: string | null } | null;
  images: { id: string; image_url: string; alt_text?: string | null }[];
  itinerary: {
    id: string;
    day_number: number;
    title: string;
    description: string | null;
    hotel: string | null;
    meals: string | null;
    transport: string | null;
  }[];
  inclusions: { id: string; item: string; sort_order?: number }[];
  exclusions: { id: string; item: string; sort_order?: number }[];
  videoEmbedUrls: string[];
  faqs: { id: string; question: string; answer: string }[];
  activeOffer?: {
    discount_percent: number | null;
    discount_flat: number | null;
    valid_to: string;
  } | null;
  termsAndConditions?: string | null;
  isDashboardPreview?: boolean;
}

type TabKey = 'overview' | 'highlights' | 'itinerary' | 'inclusions_exclusions' | 'faqs';

export function PackageDetailView({
  pkg,
  destination,
  images,
  itinerary,
  inclusions,
  exclusions,
  videoEmbedUrls,
  faqs,
  activeOffer,
  termsAndConditions,
  isDashboardPreview = false,
}: PackageDetailViewProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [termsModalOpen, setTermsModalOpen] = useState(false);

  // Accordion state for Day-by-day Itinerary (collision mode: only one open at a time)
  const [openDayId, setOpenDayId] = useState<string | null>(() => {
    return itinerary[0]?.id ?? null;
  });

  // Accordion state for FAQs (collision mode: only one open at a time)
  const [openFaqId, setOpenFaqId] = useState<string | null>(() => {
    return faqs[0]?.id ?? null;
  });

  // Read more / Show more state for Inclusions & Exclusions
  const [showAllInclusions, setShowAllInclusions] = useState(false);
  const [showAllExclusions, setShowAllExclusions] = useState(false);

  // Close modal on Escape key press
  useEffect(() => {
    if (!termsModalOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setTermsModalOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [termsModalOpen]);

  // Lock scroll when modal is open
  useEffect(() => {
    if (termsModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [termsModalOpen]);

  const toggleDay = (id: string) => {
    setOpenDayId((prev) => (prev === id ? null : id));
  };

  const toggleFaq = (id: string) => {
    setOpenFaqId((prev) => (prev === id ? null : id));
  };

  // Pricing logic
  const offerPrice = activeOffer
    ? activeOffer.discount_percent
      ? pkg.base_price * (1 - activeOffer.discount_percent / 100)
      : activeOffer.discount_flat
      ? pkg.base_price - activeOffer.discount_flat
      : null
    : null;
  const effectivePrice = offerPrice ?? pkg.discount_price;

  const tabsConfig: { id: TabKey; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'highlights', label: 'Highlights', count: pkg.highlights.length },
    { id: 'itinerary', label: 'Day-by-day itinerary', count: itinerary.length },
    {
      id: 'inclusions_exclusions',
      label: 'Inclusions/Exclusions',
      count: inclusions.length + exclusions.length,
    },
    { id: 'faqs', label: 'Frequently asked questions', count: faqs.length },
  ];

  const visibleInclusions = showAllInclusions ? inclusions : inclusions.slice(0, 5);
  const visibleExclusions = showAllExclusions ? exclusions : exclusions.slice(0, 5);

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      {/* Sticky Tab Navigation Bar */}
      <div className="sticky top-20 z-30 w-full max-w-full border-b border-ink-100 bg-white/95 backdrop-blur-md shadow-xs">
        <div className="container-page w-full max-w-full overflow-hidden">
          <div className="flex w-full max-w-full items-center gap-1.5 sm:gap-2 overflow-x-auto py-2.5 no-scrollbar scroll-smooth overscroll-x-contain">
            {tabsConfig.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-ink-600 hover:bg-ink-100/70 hover:text-ink-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && tab.count > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-ink-100 text-ink-500 group-hover:bg-ink-200'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Terms & Conditions Tab Button (Opens Modal) */}
            <button
              type="button"
              onClick={() => setTermsModalOpen(true)}
              className="group flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-ink-300 px-4 py-2 text-xs sm:text-sm font-medium text-ink-700 transition-all duration-200 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-800"
            >
              <FileText className="h-3.5 w-3.5 text-brand-600" />
              <span>Terms & conditions</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Layout with 2 Columns */}
      <div className="container-page grid gap-10 py-10 lg:grid-cols-3">
        {/* Left Column: Active Tab Panels */}
        <div className="space-y-10 lg:col-span-2">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in duration-200">
              {/* Quick Info Badges */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-ink-600">
                <span className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-1.5 font-medium text-ink-700 border border-ink-100">
                  <Clock className="h-4 w-4 text-brand-600" /> {pkg.duration_days} days /{' '}
                  {pkg.duration_nights} nights
                </span>
                {destination && (
                  <span className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-1.5 font-medium text-ink-700 border border-ink-100">
                    <MapPin className="h-4 w-4 text-brand-600" /> {destination.name}
                    {destination.country ? `, ${destination.country}` : ''}
                  </span>
                )}
                {pkg.total_seats && (
                  <span className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-1.5 font-medium text-ink-700 border border-ink-100">
                    <Users className="h-4 w-4 text-brand-600" /> Limited to {pkg.total_seats}{' '}
                    travelers
                  </span>
                )}
                {pkg.category && (
                  <span className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand-800 border border-brand-100">
                    {pkg.category}
                  </span>
                )}
              </div>

              {/* Description Section */}
              {pkg.full_description ? (
                <section className="rounded-2xl border border-ink-100 bg-white p-6 sm:p-8 shadow-xs">
                  <h2 className="font-display text-2xl font-bold text-ink-900 mb-4 flex items-center gap-2">
                    <Info className="h-5 w-5 text-brand-600" />
                    Overview
                  </h2>
                  <div className="prose prose-sm sm:prose-base max-w-none text-ink-700">
                    <ExpandableText text={pkg.full_description} collapsedLines={6} />
                  </div>
                </section>
              ) : pkg.short_description ? (
                <section className="rounded-2xl border border-ink-100 bg-white p-6 sm:p-8 shadow-xs">
                  <h2 className="font-display text-2xl font-bold text-ink-900 mb-4 flex items-center gap-2">
                    <Info className="h-5 w-5 text-brand-600" />
                    Overview
                  </h2>
                  <p className="text-ink-600 leading-relaxed">{pkg.short_description}</p>
                </section>
              ) : null}

              {/* Quick Highlights Preview inside Overview */}
              {pkg.highlights.length > 0 && (
                <section className="rounded-2xl border border-ink-100 bg-white p-6 sm:p-8 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-xl font-bold text-ink-900 flex items-center gap-2">
                      <Check className="h-5 w-5 text-brand-600" />
                      Key Highlights
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('highlights')}
                      className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                    >
                      View all ({pkg.highlights.length}) &rarr;
                    </button>
                  </div>
                  <ul className="grid gap-2.5 sm:grid-cols-2">
                    {pkg.highlights.slice(0, 4).map((h, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 rounded-xl bg-ink-50/70 p-3 text-sm text-ink-700 border border-ink-100/60"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Gallery Section */}
              {images.length > 0 && (
                <section className="rounded-2xl border border-ink-100 bg-white p-6 sm:p-8 shadow-xs">
                  <h2 className="font-display text-2xl font-bold text-ink-900 mb-4">Gallery</h2>
                  <ImageLightbox
                    images={images.map((img) => ({
                      url: img.image_url,
                      alt: img.alt_text ?? pkg.title,
                    }))}
                  />
                </section>
              )}

              {/* Videos Section */}
              {videoEmbedUrls.length > 0 && (
                <section className="rounded-2xl border border-ink-100 bg-white p-6 sm:p-8 shadow-xs">
                  <h2 className="font-display text-2xl font-bold text-ink-900 mb-4">
                    {videoEmbedUrls.length > 1 ? 'Tour Videos' : 'Tour Video'}
                  </h2>
                  <div className="space-y-4">
                    {videoEmbedUrls.map((embedUrl, i) => (
                      <div
                        key={embedUrl}
                        className="aspect-video overflow-hidden rounded-xl border border-ink-100 bg-ink-100"
                      >
                        <iframe
                          src={embedUrl}
                          title={`${pkg.title} — video ${i + 1}`}
                          className="h-full w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* TAB 2: HIGHLIGHTS */}
          {activeTab === 'highlights' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-ink-100 bg-white p-6 sm:p-8 shadow-xs">
                <div className="mb-6">
                  <h2 className="font-display text-2xl font-bold text-ink-900 flex items-center gap-2">
                    <Check className="h-6 w-6 text-brand-600" />
                    Package Highlights
                  </h2>
                  <p className="mt-1 text-sm text-ink-500">
                    Discover the memorable sights and curated experiences included in this journey.
                  </p>
                </div>

                {pkg.highlights.length > 0 ? (
                  <ul className="grid gap-3.5 sm:grid-cols-2">
                    {pkg.highlights.map((h, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 rounded-xl border border-brand-100/70 bg-brand-50/40 p-4 transition-all duration-200 hover:border-brand-300 hover:bg-brand-50"
                      >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-sm font-medium text-ink-800 leading-relaxed">{h}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-400 italic">No specific highlights listed yet.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: DAY-BY-DAY ITINERARY */}
          {activeTab === 'itinerary' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-ink-100 bg-white p-4 sm:p-6 lg:p-8 shadow-xs">
                <div className="border-b border-ink-100 pb-4 sm:pb-5 mb-5 sm:mb-6">
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700 shrink-0">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-display text-xl sm:text-2xl font-bold text-ink-900 leading-tight">
                        Day-by-Day Itinerary
                      </h2>
                      <p className="mt-0.5 text-xs sm:text-sm text-ink-500">
                        {itinerary.length} Days • Activities, destinations, and stays
                      </p>
                    </div>
                  </div>
                </div>

                {itinerary.length > 0 ? (
                  <div className="space-y-3 sm:space-y-3.5">
                    {itinerary.map((day) => {
                      const isOpen = openDayId === day.id;
                      return (
                        <div
                          key={day.id}
                          className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                            isOpen
                              ? 'border-brand-300 bg-white shadow-sm ring-1 ring-brand-100'
                              : 'border-ink-200/80 bg-white hover:border-brand-200 hover:bg-ink-50/30'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleDay(day.id)}
                            className="flex w-full items-start sm:items-center justify-between gap-3 p-3.5 sm:p-5 text-left cursor-pointer transition-colors"
                            aria-expanded={isOpen}
                          >
                            <div className="flex items-start sm:items-center gap-2.5 sm:gap-4 min-w-0 flex-1">
                              <span className="shrink-0 rounded-lg sm:rounded-xl bg-brand-50 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-brand-800 border border-brand-200/60 mt-0.5 sm:mt-0">
                                Day {day.day_number}
                              </span>
                              <h3 className="font-display text-sm sm:text-base font-semibold text-ink-900 leading-snug break-words">
                                {day.title}
                              </h3>
                            </div>
                            <div
                              className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full shrink-0 transition-transform duration-200 mt-0.5 sm:mt-0 ${
                                isOpen ? 'bg-brand-50 text-brand-600 rotate-180' : 'bg-ink-50 text-ink-400'
                              }`}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </div>
                          </button>

                          {isOpen && (
                            <div className="border-t border-ink-100 p-3.5 sm:p-5 pt-3 animate-in fade-in-50 duration-200 space-y-3 sm:space-y-3.5">
                              {day.description ? (
                                <p className="text-xs sm:text-sm text-ink-600 leading-relaxed whitespace-pre-line">
                                  {day.description}
                                </p>
                              ) : (
                                <p className="text-xs text-ink-400 italic">No details provided for this day.</p>
                              )}

                              {(day.hotel || day.meals || day.transport) && (
                                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 pt-2.5 border-t border-ink-100 text-xs">
                                  {day.hotel && (
                                    <div className="flex items-start gap-2 rounded-xl bg-ink-50/90 px-3 py-2 text-ink-700 border border-ink-100/70 min-w-0">
                                      <Hotel className="h-3.5 w-3.5 text-brand-600 shrink-0 mt-0.5" />
                                      <span className="text-ink-500 shrink-0 font-medium">Stay:</span>
                                      <span className="font-medium text-ink-900 break-words min-w-0 flex-1">{day.hotel}</span>
                                    </div>
                                  )}
                                  {day.meals && (
                                    <div className="flex items-start gap-2 rounded-xl bg-ink-50/90 px-3 py-2 text-ink-700 border border-ink-100/70 min-w-0">
                                      <Utensils className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                                      <span className="text-ink-500 shrink-0 font-medium">Meals:</span>
                                      <span className="font-medium text-ink-900 break-words min-w-0 flex-1">{day.meals}</span>
                                    </div>
                                  )}
                                  {day.transport && (
                                    <div className="flex items-start gap-2 rounded-xl bg-ink-50/90 px-3 py-2 text-ink-700 border border-ink-100/70 min-w-0">
                                      <Car className="h-3.5 w-3.5 text-sky-600 shrink-0 mt-0.5" />
                                      <span className="text-ink-500 shrink-0 font-medium">Transport:</span>
                                      <span className="font-medium text-ink-900 break-words min-w-0 flex-1">{day.transport}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-ink-400 italic">No day-by-day itinerary published yet.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: INCLUSIONS / EXCLUSIONS */}
          {activeTab === 'inclusions_exclusions' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="grid gap-6 md:grid-cols-2">
                {/* INCLUSIONS CARD */}
                <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-4 border-b border-emerald-50 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                        <h2 className="font-display text-lg font-bold text-ink-900">Inclusions</h2>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200/50">
                        {inclusions.length} items
                      </span>
                    </div>

                    {inclusions.length > 0 ? (
                      <ul className="space-y-2.5">
                        {visibleInclusions.map((i) => (
                          <li key={i.id} className="flex items-start gap-2.5 text-sm text-ink-700">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            <span>{i.item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-ink-400 italic">No inclusions specified.</p>
                    )}
                  </div>

                  {inclusions.length > 5 && (
                    <div className="mt-5 pt-3 border-t border-ink-100">
                      <button
                        type="button"
                        onClick={() => setShowAllInclusions((prev) => !prev)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                      >
                        <span>
                          {showAllInclusions
                            ? 'Show less'
                            : `Show more (+${inclusions.length - 5} items)`}
                        </span>
                        {showAllInclusions ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* EXCLUSIONS CARD */}
                <div className="rounded-2xl border border-rose-100 bg-white p-6 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-4 border-b border-rose-50 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                          <ShieldAlert className="h-5 w-5" />
                        </div>
                        <h2 className="font-display text-lg font-bold text-ink-900">Exclusions</h2>
                      </div>
                      <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200/50">
                        {exclusions.length} items
                      </span>
                    </div>

                    {exclusions.length > 0 ? (
                      <ul className="space-y-2.5">
                        {visibleExclusions.map((e) => (
                          <li key={e.id} className="flex items-start gap-2.5 text-sm text-ink-700">
                            <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                            <span>{e.item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-ink-400 italic">No exclusions specified.</p>
                    )}
                  </div>

                  {exclusions.length > 5 && (
                    <div className="mt-5 pt-3 border-t border-ink-100">
                      <button
                        type="button"
                        onClick={() => setShowAllExclusions((prev) => !prev)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800 transition-colors"
                      >
                        <span>
                          {showAllExclusions
                            ? 'Show less'
                            : `Show more (+${exclusions.length - 5} items)`}
                        </span>
                        {showAllExclusions ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: FREQUENTLY ASKED QUESTIONS */}
          {activeTab === 'faqs' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-ink-100 bg-white p-6 sm:p-8 shadow-xs">
                <div className="mb-6">
                  <h2 className="font-display text-2xl font-bold text-ink-900 flex items-center gap-2">
                    <HelpCircle className="h-6 w-6 text-brand-600" />
                    Frequently Asked Questions
                  </h2>
                  <p className="mt-1 text-sm text-ink-500">
                    Helpful answers about visas, bookings, logistics, and what to expect.
                  </p>
                </div>

                {faqs.length > 0 ? (
                  <div className="space-y-3">
                    {faqs.map((faq) => {
                      const isOpen = openFaqId === faq.id;
                      return (
                        <div
                          key={faq.id}
                          className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                            isOpen
                              ? 'border-brand-200 bg-white shadow-sm ring-1 ring-brand-100'
                              : 'border-ink-100 bg-white hover:border-ink-200 hover:bg-ink-50/30'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleFaq(faq.id)}
                            className="flex w-full items-center justify-between gap-4 p-4 sm:p-5 text-left cursor-pointer transition-colors"
                            aria-expanded={isOpen}
                          >
                            <span className="font-display text-sm sm:text-base font-semibold text-ink-900 leading-snug">
                              {faq.question}
                            </span>
                            <div
                              className={`flex h-7 w-7 items-center justify-center rounded-full shrink-0 transition-transform duration-200 ${
                                isOpen ? 'bg-brand-50 text-brand-600 rotate-180' : 'bg-ink-50 text-ink-400'
                              }`}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </div>
                          </button>

                          {isOpen && (
                            <div className="border-t border-ink-100/70 p-4 sm:p-5 pt-3 animate-in fade-in-50 duration-200">
                              <p className="text-sm text-ink-600 leading-relaxed whitespace-pre-line">
                                {faq.answer}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-ink-400 italic">No FAQs published for this package yet.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Sticky Price Card */}
        <aside className="lg:col-span-1">
          <div className="card sticky top-36 p-6 shadow-md border border-ink-100 bg-white rounded-2xl">
            {/* Package Duration Badge in Price Card */}
            <div className="flex items-center gap-3 rounded-xl bg-brand-50/90 px-3.5 py-3 text-brand-950 border border-brand-100 mb-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-xs shrink-0">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">
                  Total Duration
                </p>
                <p className="text-sm sm:text-base font-bold text-brand-950">
                  {pkg.duration_days} Days / {pkg.duration_nights} Nights
                </p>
              </div>
            </div>

            <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">
              Package Price
            </span>

            <div className="mt-2">
              {activeOffer && (
                <span className="badge-discount mb-2 inline-flex font-semibold">
                  Special offer
                </span>
              )}
              {effectivePrice ? (
                <div>
                  <span className="text-sm text-ink-400 line-through">
                    {formatCurrency(pkg.base_price, pkg.currency)}
                  </span>
                  <p className="font-display text-3xl font-bold text-brand-700">
                    {formatCurrency(effectivePrice, pkg.currency)}{' '}
                    <span className="text-sm font-normal text-ink-500">/ person</span>
                  </p>
                </div>
              ) : (
                <p className="font-display text-3xl font-bold text-brand-700">
                  {formatCurrency(pkg.base_price, pkg.currency)}{' '}
                  <span className="text-sm font-normal text-ink-500">/ person</span>
                </p>
              )}
            </div>

            <p className="mt-3 text-xs text-ink-400">
              * Starting price per person • Taxes &amp; fees included
            </p>

            {pkg.total_seats && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
                <Users className="h-3.5 w-3.5 text-brand-600" />
                <span>Limited to {pkg.total_seats} travelers</span>
              </div>
            )}

            <div className="mt-5 border-t border-ink-100 pt-5">
              {!isDashboardPreview ? (
                <Link
                  href={`/booking?packageId=${encodeURIComponent(pkg.id)}`}
                  className="btn-primary flex w-full items-center justify-center gap-2 py-3.5 text-center text-sm font-semibold shadow-md transition-all hover:shadow-lg"
                >
                  <span>Send Enquiry</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <button
                  type="button"
                  className="btn-primary flex w-full items-center justify-center gap-2 py-3.5 text-center text-sm font-semibold shadow-md opacity-90 cursor-default"
                >
                  <span>Send Enquiry (Preview)</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
              <p className="mt-2.5 text-center text-[11px] text-ink-400">
                Tailored itinerary &amp; customized quote
              </p>
            </div>

            {/* Quick Link to Terms Modal */}
            <div className="mt-4 pt-3 border-t border-ink-100 text-center">
              <button
                type="button"
                onClick={() => setTermsModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-brand-700 transition-colors"
              >
                <FileText className="h-3 w-3" />
                <span>View Terms &amp; Conditions</span>
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* TERMS & CONDITIONS MODAL */}
      {termsModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setTermsModalOpen(false)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-ink-100 overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-ink-100 bg-ink-50/50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-ink-900 leading-snug">
                    Terms &amp; Conditions
                  </h3>
                  <p className="text-xs text-ink-500">
                    Booking policies, cancellation guidelines, and customer terms
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTermsModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 text-sm text-ink-700 leading-relaxed space-y-4">
              {termsAndConditions && termsAndConditions.trim() ? (
                <div className="whitespace-pre-line text-ink-600 font-normal">
                  {termsAndConditions}
                </div>
              ) : (
                <div className="py-8 text-center text-ink-400">
                  <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>Standard terms and conditions apply to this package booking.</p>
                  <p className="text-xs mt-1 text-ink-400">
                    Contact our travel consultants for complete details regarding cancellations, changes, and refunds.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end px-6 py-4 border-t border-ink-100 bg-ink-50/50">
              <button
                type="button"
                onClick={() => setTermsModalOpen(false)}
                className="btn-outline px-5 py-2 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
