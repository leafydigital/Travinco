'use client';

import { useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Search,
  X,
  MapPin,
  ArrowRight,
  ShieldCheck,
  Compass,
  ChevronLeft,
  ChevronRight,
  Globe,
} from 'lucide-react';
import type { DestinationsPageContent } from '@/lib/destinations-page-content-types';
import { DEFAULT_DESTINATIONS_PAGE_CONTENT } from '@/lib/destinations-page-content-types';

export interface DestinationExplorerItem {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  description: string | null;
  cover_image_url: string | null;
  is_featured?: boolean;
}

interface DestinationsExplorerProps {
  initialDestinations: DestinationExplorerItem[];
  initialSearch?: string;
  pageContent?: DestinationsPageContent;
}

const ITEMS_PER_PAGE = 6;

export function DestinationsExplorer({
  initialDestinations,
  initialSearch = '',
  pageContent = DEFAULT_DESTINATIONS_PAGE_CONTENT,
}: DestinationsExplorerProps) {
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [currentPage, setCurrentPage] = useState(1);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Filter destinations by search query
  const filteredDestinations = useMemo(() => {
    let list = initialDestinations;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((dest) => {
        const matchName = dest.name.toLowerCase().includes(q);
        const matchCountry = dest.country?.toLowerCase().includes(q) ?? false;
        const matchDesc = dest.description?.toLowerCase().includes(q) ?? false;
        return matchName || matchCountry || matchDesc;
      });
    }

    return list;
  }, [initialDestinations, searchQuery]);

  // Reset pagination when search query changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setCurrentPage(1);
  };

  // Pagination calculation
  const totalItems = filteredDestinations.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedDestinations = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredDestinations.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredDestinations, validCurrentPage]);

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    if (resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-sand-50/40 pb-20">
      {/* ── 1. HERO SECTION ── */}
      <section className="relative min-h-[420px] sm:min-h-[460px] md:min-h-[500px] w-full overflow-hidden bg-navy-950 text-white flex flex-col justify-center items-center text-center px-4 pt-28 pb-16">
        {/* Background photo with luxury dark atmospheric overlay */}
        {pageContent.hero.background_image_url && (
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-700 transform scale-100"
            style={{ backgroundImage: `url(${pageContent.hero.background_image_url})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-navy-950/85 via-navy-950/70 to-navy-950/95 backdrop-blur-[1px]" />
          </div>
        )}

        <div className="relative z-10 max-w-3xl mx-auto space-y-4 px-4 animate-in fade-in zoom-in-95 duration-500">
          {pageContent.hero.badge && (
            <div className="inline-flex items-center rounded-full bg-white/10 backdrop-blur-md px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-sand-200 border border-white/20 shadow-sm">
              <span>{pageContent.hero.badge}</span>
            </div>
          )}

          <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-extrabold uppercase tracking-tight text-white drop-shadow-xl leading-tight">
            {pageContent.hero.title || 'DESTINATIONS'}
          </h1>

          {pageContent.hero.subtitle && (
            <p className="mt-2 text-sm sm:text-base md:text-lg text-white/85 font-light leading-relaxed max-w-2xl mx-auto drop-shadow-sm">
              {pageContent.hero.subtitle}
            </p>
          )}

          {/* Trust Highlights */}
          {pageContent.hero.pillars && pageContent.hero.pillars.length > 0 && (
            <div className="pt-4 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm text-white/75 font-medium">
              {pageContent.hero.pillars.map((pillar, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>{pillar.label}</span>
                  {i < pageContent.hero.pillars.length - 1 && (
                    <span className="hidden sm:inline-block ml-3 text-white/30">•</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── 2. SEARCH BAR & CONTROLS ── */}
      <div ref={resultsRef} className="container-page -mt-8 relative z-20">
        <div className="rounded-2xl sm:rounded-3xl border border-ink-100 bg-white p-4 sm:p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={
                  pageContent.search.placeholder ||
                  'Search destinations by name or country (e.g. Kerala, Munnar, Maldives)...'
                }
                className="input h-12 w-full pl-12 pr-10 text-xs sm:text-sm rounded-xl font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition"
                  title="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="btn-outline h-12 px-5 text-xs font-semibold rounded-xl text-ink-600 hover:text-ink-900 shrink-0 w-full sm:w-auto"
              >
                Clear Filters
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-ink-500 px-1">
            <span>
              Showing <strong className="font-semibold text-ink-800">{filteredDestinations.length}</strong>{' '}
              {filteredDestinations.length === 1 ? 'destination' : 'destinations'}
              {searchQuery && ` matching "${searchQuery}"`}
            </span>
            {totalPages > 1 && (
              <span>
                Page <strong className="font-semibold text-ink-800">{validCurrentPage}</strong> of{' '}
                <strong className="font-semibold text-ink-800">{totalPages}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. DESTINATIONS CARDS GRID ── */}
      <section className="container-page mt-10">
        {filteredDestinations.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-ink-200 bg-white p-12 text-center space-y-4 shadow-xs">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <MapPin className="h-7 w-7" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="font-display text-lg font-bold text-ink-900">
                {pageContent.empty_state.title || 'No destinations found'}
              </h3>
              <p className="text-xs sm:text-sm text-ink-500 leading-relaxed">
                {pageContent.empty_state.description ||
                  "We couldn't find any destinations matching your search. Try another search term or browse all places."}
              </p>
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="btn-primary inline-flex items-center gap-2 text-xs px-5 py-2.5 rounded-xl shadow-xs"
              >
                <Compass className="h-4 w-4" />
                <span>{pageContent.empty_state.button_text || 'Show All Destinations'}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {paginatedDestinations.map((d) => (
              <Link
                key={d.id}
                href={`/destinations/${d.slug}`}
                className="group relative flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-ink-100 bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-brand-200 cursor-pointer"
              >
                {/* Visual Cover Photo */}
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-ink-100">
                  {d.cover_image_url ? (
                    <Image
                      src={d.cover_image_url}
                      alt={d.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-ink-300 text-xs">
                      No cover photo
                    </div>
                  )}

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-navy-950/70 via-navy-950/20 to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    {d.country ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-xs px-2.5 py-1 text-[11px] font-semibold text-ink-800 shadow-xs">
                        <Globe className="h-3 w-3 text-brand-600" />
                        <span>{d.country}</span>
                      </span>
                    ) : (
                      <span />
                    )}

                    {d.is_featured && (
                      <span className="inline-flex items-center rounded-full bg-sand-400 text-ink-950 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-xs">
                        Featured
                      </span>
                    )}
                  </div>

                  {/* Bottom Image Overlay Text */}
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white/80 uppercase tracking-wider">
                      <MapPin className="h-3 w-3 text-sand-300" />
                      <span>Explore Destination</span>
                    </span>
                    <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight drop-shadow-md">
                      {d.name}
                    </h2>
                  </div>
                </div>

                {/* Card Content & Action Link */}
                <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
                  {d.description ? (
                    <p className="text-xs sm:text-sm text-ink-600 line-clamp-2 leading-relaxed">
                      {d.description}
                    </p>
                  ) : (
                    <p className="text-xs sm:text-sm text-ink-400 italic">
                      Explore our handcrafted itineraries and custom retreat stays.
                    </p>
                  )}

                  <div className="pt-2 border-t border-ink-100 flex items-center justify-between text-xs font-bold text-brand-700 group-hover:text-brand-900 transition-colors">
                    <span>View Itineraries &amp; Packages</span>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-700 group-hover:bg-brand-600 group-hover:text-white transition-all transform group-hover:translate-x-1">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* ── 4. PAGINATION CONTROLS ── */}
        {totalPages > 1 && (
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-ink-100 pt-6">
            <span className="text-xs text-ink-500">
              Showing{' '}
              <strong className="font-semibold text-ink-800">
                {(validCurrentPage - 1) * ITEMS_PER_PAGE + 1}
              </strong>{' '}
              to{' '}
              <strong className="font-semibold text-ink-800">
                {Math.min(validCurrentPage * ITEMS_PER_PAGE, totalItems)}
              </strong>{' '}
              of <strong className="font-semibold text-ink-800">{totalItems}</strong> destinations
            </span>

            <nav className="inline-flex items-center gap-1.5" aria-label="Pagination">
              {/* Prev Button */}
              <button
                type="button"
                onClick={() => handlePageChange(validCurrentPage - 1)}
                disabled={validCurrentPage <= 1}
                className="inline-flex items-center gap-1 rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
              </button>

              {/* Numbered Page Buttons */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, idx) => {
                  const pageNum = idx + 1;
                  const isActive = pageNum === validCurrentPage;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => handlePageChange(pageNum)}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold transition shadow-xs ${
                        isActive
                          ? 'bg-brand-600 text-white shadow-brand-600/30'
                          : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              {/* Next Button */}
              <button
                type="button"
                onClick={() => handlePageChange(validCurrentPage + 1)}
                disabled={validCurrentPage >= totalPages}
                className="inline-flex items-center gap-1 rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          </div>
        )}
      </section>

      {/* ── 5. BOTTOM CUSTOM HOLIDAY CTA BANNER ── */}
      {pageContent.bottom_cta && (
        <section className="container-page mt-16">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-brand-950 to-navy-900 p-8 sm:p-12 text-white shadow-xl">
            <div className="relative z-10 max-w-2xl space-y-3">
              {pageContent.bottom_cta.badge && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sand-400/20 px-3 py-1 text-xs font-semibold text-sand-300 border border-sand-400/30">
                  <Compass className="h-3.5 w-3.5 text-sand-300" />
                  <span>{pageContent.bottom_cta.badge}</span>
                </span>
              )}
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
                {pageContent.bottom_cta.title}
              </h2>
              {pageContent.bottom_cta.description && (
                <p className="text-xs sm:text-sm text-white/80 font-light leading-relaxed">
                  {pageContent.bottom_cta.description}
                </p>
              )}
              <div className="pt-2">
                <Link
                  href={pageContent.bottom_cta.button_link || '/booking'}
                  className="btn-cta inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl shadow-lg"
                >
                  <span>{pageContent.bottom_cta.button_text || 'Request Custom Plan'}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
