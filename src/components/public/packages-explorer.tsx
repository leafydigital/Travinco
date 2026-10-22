'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Search,
  X,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Compass,
  ShieldCheck,
  RotateCcw,
  Calendar,
  Layers,
  ArrowUpDown,
} from 'lucide-react';
import { PackageCard, type PackageCardData } from './package-card';
import type { PackagesPageContent } from '@/lib/packages-page-content-types';
import { DEFAULT_PACKAGES_PAGE_CONTENT } from '@/lib/packages-page-content-types';

export interface PackageExplorerItem extends PackageCardData {
  id: string;
  category?: string | null;
  destination_id?: string | null;
  destinationSlug?: string;
  is_featured?: boolean;
}

export interface DestinationFilterItem {
  id: string;
  name: string;
  slug: string;
}

import { CardGridSkeleton } from '@/components/ui/skeleton';

interface PackagesExplorerProps {
  initialPackages: PackageExplorerItem[];
  destinations: DestinationFilterItem[];
  initialCategory?: string;
  initialDestination?: string;
  initialSearch?: string;
  pageContent?: PackagesPageContent;
  isLoading?: boolean;
}

const ITEMS_PER_PAGE = 6;

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'honeymoon', label: 'Honeymoon' },
  { value: 'family', label: 'Family' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'pilgrimage', label: 'Pilgrimage' },
  { value: 'budget', label: 'Budget' },
  { value: 'other', label: 'Other' },
];

export function PackagesExplorer({
  initialPackages,
  destinations,
  initialCategory = '',
  initialDestination = '',
  initialSearch = '',
  pageContent,
  isLoading = false,
}: PackagesExplorerProps) {
  const content = pageContent || DEFAULT_PACKAGES_PAGE_CONTENT;
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedDestination, setSelectedDestination] = useState(initialDestination);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'duration-asc' | 'duration-desc'>('featured');
  const [currentPage, setCurrentPage] = useState(1);

  const listRef = useRef<HTMLDivElement>(null);

  // Reset to page 1 whenever search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDestination, selectedCategory, sortBy]);

  // Filter and sort packages
  const filteredAndSortedPackages = useMemo(() => {
    let result = [...initialPackages];

    // 1. Search by name / title / destination
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((pkg) => {
        const matchesTitle = pkg.title.toLowerCase().includes(q);
        const matchesDest = pkg.destinationName?.toLowerCase().includes(q);
        const matchesDesc = pkg.short_description?.toLowerCase().includes(q);
        return matchesTitle || matchesDest || matchesDesc;
      });
    }

    // 2. Filter by destination slug
    if (selectedDestination) {
      result = result.filter(
        (pkg) =>
          pkg.destinationSlug === selectedDestination ||
          pkg.destination_id === selectedDestination
      );
    }

    // 3. Filter by category
    if (selectedCategory) {
      result = result.filter(
        (pkg) => pkg.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // 4. Sort
    result.sort((a, b) => {
      if (sortBy === 'price-asc') {
        const priceA = a.discount_price ?? a.base_price;
        const priceB = b.discount_price ?? b.base_price;
        return priceA - priceB;
      }
      if (sortBy === 'price-desc') {
        const priceA = a.discount_price ?? a.base_price;
        const priceB = b.discount_price ?? b.base_price;
        return priceB - priceA;
      }
      if (sortBy === 'duration-asc') {
        return a.duration_days - b.duration_days;
      }
      if (sortBy === 'duration-desc') {
        return b.duration_days - a.duration_days;
      }
      // 'featured'
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return 0;
    });

    return result;
  }, [initialPackages, searchQuery, selectedDestination, selectedCategory, sortBy]);

  // Pagination calculation
  const totalItems = filteredAndSortedPackages.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedPackages = useMemo(() => {
    const start = (validPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedPackages.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAndSortedPackages, validPage]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    if (listRef.current) {
      const topOffset = listRef.current.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: topOffset, behavior: 'smooth' });
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedDestination('');
    setSelectedCategory('');
    setSortBy('featured');
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    searchQuery.trim() || selectedDestination || selectedCategory || sortBy !== 'featured'
  );

  return (
    <div className="bg-sand-50/50 min-h-screen">
      {/* ── 1. HERO SECTION (TEXT CENTER: "PACKAGES" + HERO BACKGROUND IMAGE) ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950 pt-32 pb-20 sm:pt-36 sm:pb-24 lg:pt-40 lg:pb-28 text-white border-b border-white/10 shadow-xl">
        {/* Hero Background Image with luxury dark overlay */}
        {content.hero.background_image_url && (
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700"
            style={{ backgroundImage: `url(${content.hero.background_image_url})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-navy-950/85 via-navy-950/75 to-navy-950/90 backdrop-blur-[0.5px]" />
          </div>
        )}

        {/* Ambient atmospheric backdrop lighting */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[420px] w-[640px] sm:w-[900px] rounded-full bg-gradient-to-tr from-brand-600/20 via-emerald-500/15 to-ocean-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />

        <div className="container-page relative z-10 flex flex-col items-center text-center max-w-3xl mx-auto px-4">
          {/* Top Badge */}
          {content.hero.badge && (
            <span className="inline-flex items-center rounded-full bg-white/10 backdrop-blur-md px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-sand-300 border border-white/15 shadow-xs mb-5">
              <span>{content.hero.badge}</span>
            </span>
          )}

          {/* Centered Heading */}
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white uppercase text-center leading-tight">
            {content.hero.title || 'PACKAGES'}
          </h1>

          {/* Centered Subtitle */}
          {content.hero.subtitle && (
            <p className="mt-4 text-base sm:text-lg text-white/80 font-light leading-relaxed max-w-2xl text-center">
              {content.hero.subtitle}
            </p>
          )}

          {/* Quick Pillars */}
          {content.hero.pillars && content.hero.pillars.length > 0 && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs text-white/70">
              {content.hero.pillars.map((pillar, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>{pillar.label}</span>
                  {i < content.hero.pillars.length - 1 && (
                    <span className="hidden sm:inline text-white/30 ml-2">•</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── 2. SEARCH & FILTER TOOLBAR (STICKY/FLOATING) ── */}
      <div ref={listRef} className="container-page -mt-7 relative z-20 px-4">
        <div className="rounded-2xl bg-white p-4 sm:p-5 shadow-xl border border-ink-200/80">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-center">
            {/* Search Input (Customer can search package by name) */}
            <div className="md:col-span-5 relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-400">
                <Search className="h-4 w-4 text-brand-600" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={content.search?.placeholder || 'Search packages by name (e.g. Munnar, Kerala, Maldives)...'}
                className="input pl-10 pr-10 h-11 text-xs sm:text-sm font-medium rounded-xl border-ink-200 focus:border-brand-600 focus:ring-brand-600/20 w-full"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-400 hover:text-ink-700 cursor-pointer"
                  title="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Destination Select */}
            <div className="md:col-span-3">
              <select
                value={selectedDestination}
                onChange={(e) => setSelectedDestination(e.target.value)}
                className="input h-11 text-xs sm:text-sm font-medium rounded-xl border-ink-200 w-full cursor-pointer"
              >
                <option value="">All Destinations</option>
                {destinations.map((d) => (
                  <option key={d.id} value={d.slug}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Select */}
            <div className="md:col-span-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="input h-11 text-xs sm:text-sm font-medium rounded-xl border-ink-200 w-full cursor-pointer"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Select */}
            <div className="md:col-span-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="input h-11 text-xs sm:text-sm font-medium rounded-xl border-ink-200 w-full cursor-pointer"
              >
                <option value="featured">Featured First</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="duration-asc">Duration: Short to Long</option>
                <option value="duration-desc">Duration: Long to Short</option>
              </select>
            </div>
          </div>

          {/* Active Filter Chips / Status */}
          <div className="mt-3 pt-3 border-t border-ink-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink-500">
                Found {totalItems} {totalItems === 1 ? 'package' : 'packages'}
              </span>

              {searchQuery.trim() && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-brand-50 border border-brand-200 px-2.5 py-0.5 text-brand-800 font-medium">
                  Name: &ldquo;{searchQuery}&rdquo;
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="hover:text-brand-950"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {selectedDestination && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-ocean-50 border border-ocean-200 px-2.5 py-0.5 text-ocean-800 font-medium">
                  Destination: {destinations.find((d) => d.slug === selectedDestination)?.name || selectedDestination}
                  <button
                    type="button"
                    onClick={() => setSelectedDestination('')}
                    className="hover:text-ocean-950"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {selectedCategory && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-sand-100 border border-sand-300 px-2.5 py-0.5 text-ink-800 font-medium capitalize">
                  Category: {selectedCategory}
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('')}
                    className="hover:text-ink-950"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1 text-ink-500 hover:text-brand-700 font-semibold transition cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. PACKAGES GRID & PAGINATION ── */}
      <section className="container-page py-10 sm:py-14 px-4">
        {isLoading ? (
          <CardGridSkeleton count={6} />
        ) : totalItems === 0 ? (
          <div className="rounded-3xl border border-dashed border-ink-200 bg-white p-12 text-center shadow-xs">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 mb-4">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="font-display text-xl font-bold text-ink-900">
              {content.empty_state?.title || 'No packages found'}
            </h3>
            <p className="mt-2 text-sm text-ink-500 max-w-md mx-auto">
              {searchQuery
                ? `We couldn't find any packages matching "${searchQuery}". ${content.empty_state?.description || 'Try another package name or clear your filters.'}`
                : content.empty_state?.description || 'No packages found matching your current filter. Try clearing your filters.'}
            </p>
            <button
              type="button"
              onClick={handleClearFilters}
              className="mt-5 btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{content.empty_state?.button_text || 'Show All Packages'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Packages Grid */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedPackages.map((pkg) => (
                <PackageCard key={pkg.id || pkg.slug} pkg={pkg} />
              ))}
            </div>

            {/* ── 4. PAGINATION CONTROLS ── */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-ink-200">
                <p className="text-xs font-medium text-ink-500">
                  Showing{' '}
                  <span className="font-bold text-ink-900">
                    {(validPage - 1) * ITEMS_PER_PAGE + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-bold text-ink-900">
                    {Math.min(validPage * ITEMS_PER_PAGE, totalItems)}
                  </span>{' '}
                  of <span className="font-bold text-ink-900">{totalItems}</span> packages
                </p>

                <nav aria-label="Pagination" className="inline-flex items-center gap-1.5">
                  {/* Previous Button */}
                  <button
                    type="button"
                    onClick={() => handlePageChange(validPage - 1)}
                    disabled={validPage <= 1}
                    className="inline-flex items-center gap-1 rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-700 transition hover:bg-ink-50 disabled:opacity-40 disabled:pointer-events-none shadow-xs cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </button>

                  {/* Page Numbers */}
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    const isActive = pageNum === validPage;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => handlePageChange(pageNum)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`h-9 min-w-[36px] px-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
                          isActive
                            ? 'bg-brand-600 text-white shadow-brand-600/25'
                            : 'bg-white border border-ink-200 text-ink-700 hover:bg-ink-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  {/* Next Button */}
                  <button
                    type="button"
                    onClick={() => handlePageChange(validPage + 1)}
                    disabled={validPage >= totalPages}
                    className="inline-flex items-center gap-1 rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-700 transition hover:bg-ink-50 disabled:opacity-40 disabled:pointer-events-none shadow-xs cursor-pointer"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </nav>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── 5. CUSTOM VACATION CALLOUT (BOTTOM BANNER) ── */}
      <section className="container-page pb-16 px-4">
        <div className="rounded-3xl bg-gradient-to-r from-navy-950 via-brand-900 to-navy-950 p-7 sm:p-10 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 border border-white/10">
          <div className="space-y-2 text-center md:text-left">
            {content.bottom_cta?.badge && (
              <span className="inline-flex items-center text-xs font-semibold uppercase tracking-wider text-sand-300">
                <span>{content.bottom_cta.badge}</span>
              </span>
            )}
            <h3 className="text-xl sm:text-2xl font-bold font-display text-white">
              {content.bottom_cta?.title || 'We design private custom holidays tailored to you'}
            </h3>
            {content.bottom_cta?.description && (
              <p className="text-sm text-white/80 max-w-xl font-light">
                {content.bottom_cta.description}
              </p>
            )}
          </div>
          <Link
            href={content.bottom_cta?.button_link || '/booking'}
            className="btn-cta px-7 py-3 text-sm font-semibold shrink-0 shadow-lg"
          >
            {content.bottom_cta?.button_text || 'Request Custom Plan'}
          </Link>
        </div>
      </section>
    </div>
  );
}
