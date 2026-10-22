'use client';

import { useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Compass,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Bookmark,
  Search,
  X,
} from 'lucide-react';
import type { BlogPageContent } from '@/lib/blog-page-content-types';
import { DEFAULT_BLOG_PAGE_CONTENT } from '@/lib/blog-page-content-types';
import { formatDate } from '@/lib/utils/format';
import { CardGridSkeleton } from '@/components/ui/skeleton';

export interface BlogExplorerPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  created_at: string;
  category?: string | null;
}

interface BlogExplorerProps {
  initialPosts: BlogExplorerPost[];
  pageContent?: BlogPageContent;
  isLoading?: boolean;
}

const ITEMS_PER_PAGE = 7; // 1 featured + 6 grid on page 1, or 6 grid on subsequent pages

export function BlogExplorer({
  initialPosts,
  pageContent = DEFAULT_BLOG_PAGE_CONTENT,
  isLoading = false,
}: BlogExplorerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const contentTopRef = useRef<HTMLDivElement>(null);

  // Search filter across title, excerpt, slug, and category
  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return initialPosts;
    const q = searchQuery.toLowerCase().trim();
    return initialPosts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.excerpt && p.excerpt.toLowerCase().includes(q)) ||
        p.slug.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
  }, [initialPosts, searchQuery]);

  // Pagination calculation
  const totalItems = filteredPosts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / (ITEMS_PER_PAGE - 1)));
  const validCurrentPage = Math.min(currentPage, totalPages);

  // Split featured story (first post on page 1) and standard grid
  const isFirstPage = validCurrentPage === 1;
  const featuredPost = isFirstPage && filteredPosts.length > 0 ? filteredPosts[0] : null;

  const gridPosts = useMemo(() => {
    if (isFirstPage) {
      return filteredPosts.slice(1, ITEMS_PER_PAGE);
    }
    const startIndex = (validCurrentPage - 1) * 6;
    return filteredPosts.slice(startIndex, startIndex + 6);
  }, [filteredPosts, validCurrentPage, isFirstPage]);

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    if (contentTopRef.current) {
      contentTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-sand-50/40 pb-24">
      {/* ── 1. ATMOSPHERIC HERO SECTION ── */}
      <section className="relative min-h-[380px] sm:min-h-[440px] md:min-h-[480px] w-full overflow-hidden bg-navy-950 text-white flex flex-col justify-center items-center text-center px-4 pt-32 pb-20">
        {/* Background photo with luxury dark atmospheric overlay */}
        {pageContent.hero.background_image_url && (
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-700 transform scale-100"
            style={{ backgroundImage: `url(${pageContent.hero.background_image_url})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-navy-950/85 via-navy-950/70 to-navy-950/95 backdrop-blur-[1px]" />
          </div>
        )}

        {/* Ambient Top Glow */}
        <div className="absolute -top-28 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto space-y-4 px-4 animate-in fade-in zoom-in-95 duration-500">
          {pageContent.hero.badge && (
            <div className="inline-flex items-center rounded-full bg-white/10 backdrop-blur-md px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-sand-200 border border-white/20 shadow-sm">
              <span>{pageContent.hero.badge}</span>
            </div>
          )}

          <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-extrabold uppercase tracking-tight text-white drop-shadow-xl leading-tight">
            {pageContent.hero.title || 'BLOG & STORIES'}
          </h1>

          {pageContent.hero.subtitle && (
            <p className="mt-2 text-sm sm:text-base md:text-lg text-white/85 font-light leading-relaxed max-w-2xl mx-auto drop-shadow-sm">
              {pageContent.hero.subtitle}
            </p>
          )}

          {/* Highlights / Pillars */}
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
      <div ref={contentTopRef} className="container-page -mt-8 relative z-20">
        <div className="rounded-2xl sm:rounded-3xl border border-ink-100 bg-white p-4 sm:p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={
                  pageContent.search?.placeholder ||
                  'Search travel stories, destinations, or tips (e.g. Kerala, Bali, Munnar)...'
                }
                className="input h-12 w-full pl-12 pr-10 text-xs sm:text-sm rounded-xl font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 p-1 cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {searchQuery && (
            <div className="mt-3 flex items-center justify-between text-xs text-ink-500 border-t border-ink-100 pt-2.5">
              <span>
                Found <strong>{filteredPosts.length}</strong>{' '}
                {filteredPosts.length === 1 ? 'story' : 'stories'} for &ldquo;{searchQuery}&rdquo;
              </span>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="font-semibold text-brand-700 hover:underline cursor-pointer"
              >
                Clear filter
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. EDITORIAL ARTICLES SECTION ── */}
      <div className="container-page pt-10 sm:pt-14">
        {isLoading ? (
          <div className="space-y-12">
            {/* Featured Story Skeleton */}
            <div className="rounded-3xl border border-ink-100 bg-white shadow-lg overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                <div className="lg:col-span-7 min-h-[300px] sm:min-h-[380px] bg-ink-100 animate-pulse" />
                <div className="lg:col-span-5 p-6 sm:p-10 flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <div className="h-4 w-32 rounded bg-ink-100 animate-pulse" />
                    <div className="h-8 w-4/5 rounded-lg bg-ink-200/80 animate-pulse" />
                    <div className="space-y-2">
                      <div className="h-4 w-full rounded bg-ink-100 animate-pulse" />
                      <div className="h-4 w-full rounded bg-ink-100 animate-pulse" />
                      <div className="h-4 w-2/3 rounded bg-ink-100 animate-pulse" />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-ink-100 flex items-center justify-between">
                    <div className="h-5 w-28 rounded bg-ink-100 animate-pulse" />
                    <div className="h-8 w-8 rounded-full bg-ink-100 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
            {/* Story Grid Skeleton */}
            <CardGridSkeleton count={6} />
          </div>
        ) : filteredPosts.length === 0 ? (
          /* Empty state */
          <div className="rounded-3xl border border-dashed border-ink-200 bg-white p-12 sm:p-14 text-center space-y-4 shadow-xs max-w-xl mx-auto">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <BookOpen className="h-7 w-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-display text-lg font-bold text-ink-900">
                {pageContent.empty_state?.title || 'No articles found'}
              </h3>
              <p className="text-xs sm:text-sm text-ink-500 leading-relaxed">
                {pageContent.empty_state?.description ||
                  'We couldn’t find any blog articles matching your search. Try another topic or browse all stories.'}
              </p>
            </div>
            {searchQuery ? (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className="btn-primary inline-flex items-center gap-2 text-xs px-5 py-2.5 rounded-xl shadow-xs cursor-pointer"
                >
                  <BookOpen className="h-4 w-4" />
                  <span>{pageContent.empty_state?.button_text || 'Show All Articles'}</span>
                </button>
              </div>
            ) : (
              <div className="pt-2">
                <Link
                  href="/packages"
                  className="btn-primary inline-flex items-center gap-2 text-xs px-5 py-2.5 rounded-xl shadow-xs"
                >
                  <Compass className="h-4 w-4" />
                  <span>Explore Packages</span>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-12">
            {/* ── Featured Magazine Lead Card (Only on Page 1) ── */}
            {featuredPost && (
              <div className="rounded-3xl border border-ink-100 bg-white shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                  {/* Featured Cover Photo */}
                  <Link
                    href={`/blog/${featuredPost.slug}`}
                    className="relative lg:col-span-7 aspect-[16/10] sm:aspect-[16/9] lg:aspect-auto min-h-[280px] sm:min-h-[380px] overflow-hidden bg-ink-100 block cursor-pointer"
                  >
                    {featuredPost.cover_image_url ? (
                      <Image
                        src={featuredPost.cover_image_url}
                        alt={featuredPost.title}
                        fill
                        priority
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        sizes="(max-width: 1024px) 100vw, 60vw"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-ink-400 text-sm">
                        No cover photo
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-navy-950/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

                    <div className="absolute top-4 left-4">
                      <span className="inline-flex items-center rounded-full bg-brand-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md">
                        Featured Story
                      </span>
                    </div>
                  </Link>

                  {/* Featured Content Details */}
                  <div className="lg:col-span-5 p-6 sm:p-9 lg:p-10 flex flex-col justify-between space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-xs text-ink-500 font-medium">
                        <span className="flex items-center gap-1.5 text-brand-700 font-semibold">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatDate(featuredPost.created_at)}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-ink-400" />
                          <span>4 min read</span>
                        </span>
                      </div>

                      <h2 className="font-display text-2xl sm:text-3xl lg:text-3xl font-extrabold text-ink-950 group-hover:text-brand-700 transition-colors leading-tight">
                        <Link href={`/blog/${featuredPost.slug}`}>
                          {featuredPost.title}
                        </Link>
                      </h2>

                      {featuredPost.excerpt && (
                        <p className="text-sm sm:text-base text-ink-600 leading-relaxed line-clamp-3">
                          {featuredPost.excerpt}
                        </p>
                      )}
                    </div>

                    <div className="pt-4 border-t border-ink-100 flex items-center justify-between">
                      <Link
                        href={`/blog/${featuredPost.slug}`}
                        className="inline-flex items-center gap-2 text-sm font-bold text-brand-700 group-hover:text-brand-900 transition-colors"
                      >
                        <span>Read Full Story</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-700 group-hover:bg-brand-600 group-hover:text-white transition-all transform group-hover:translate-x-1 shadow-xs">
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Editorial Articles Grid ── */}
            {gridPosts.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-ink-200/80 pb-3">
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-ink-950">
                    {isFirstPage ? 'Latest Articles & Guides' : 'All Travel Articles'}
                  </h3>
                  <span className="text-xs text-ink-500 font-medium">
                    {initialPosts.length} total publications
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                  {gridPosts.map((post) => (
                    <article
                      key={post.id}
                      className="group relative flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-ink-100 bg-white shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-brand-200"
                    >
                      {/* Visual Cover Photo */}
                      <Link
                        href={`/blog/${post.slug}`}
                        className="relative aspect-[16/10] w-full overflow-hidden bg-ink-100 block cursor-pointer"
                      >
                        {post.cover_image_url ? (
                          <Image
                            src={post.cover_image_url}
                            alt={post.title}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                            sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-ink-300 text-xs">
                            No cover photo
                          </div>
                        )}

                        {/* Subtle Vignette Scrim */}
                        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

                        {post.category && (
                          <div className="absolute top-3 left-3">
                            <span className="inline-flex items-center rounded-full bg-white/95 backdrop-blur-xs px-2.5 py-1 text-[11px] font-semibold text-brand-800 shadow-xs">
                              {post.category}
                            </span>
                          </div>
                        )}
                      </Link>

                      {/* Article Details */}
                      <div className="flex flex-1 flex-col justify-between p-5 sm:p-6 space-y-4">
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2.5 text-[11px] text-ink-400 font-medium">
                            <span className="flex items-center gap-1 text-brand-700 font-semibold">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(post.created_at)}</span>
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>3 min read</span>
                            </span>
                          </div>

                          <h4 className="font-display text-lg sm:text-xl font-bold tracking-tight text-ink-950 group-hover:text-brand-700 transition-colors leading-snug line-clamp-2">
                            <Link href={`/blog/${post.slug}`}>
                              {post.title}
                            </Link>
                          </h4>

                          {post.excerpt && (
                            <p className="text-xs sm:text-sm text-ink-600 line-clamp-2 leading-relaxed">
                              {post.excerpt}
                            </p>
                          )}
                        </div>

                        <div className="pt-3 border-t border-ink-100 flex items-center justify-between">
                          <Link
                            href={`/blog/${post.slug}`}
                            className="inline-flex items-center gap-2 text-xs font-bold text-brand-700 group-hover:text-brand-900 transition-colors"
                          >
                            <span>Read Article</span>
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-700 group-hover:bg-brand-600 group-hover:text-white transition-all transform group-hover:translate-x-1 shadow-xs">
                              <ArrowRight className="h-3.5 w-3.5" />
                            </div>
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 3. PAGINATION CONTROLS ── */}
        {totalPages > 1 && (
          <nav
            aria-label="Blog pagination"
            className="mt-14 flex items-center justify-center gap-2 border-t border-ink-200/70 pt-8"
          >
            <button
              type="button"
              onClick={() => handlePageChange(validCurrentPage - 1)}
              disabled={validCurrentPage <= 1}
              className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold text-ink-700 bg-white border border-ink-200 rounded-xl hover:bg-ink-50 disabled:opacity-40 disabled:pointer-events-none transition shadow-xs cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>

            <div className="flex items-center gap-1.5 px-2">
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNum = idx + 1;
                const isActive = pageNum === validCurrentPage;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => handlePageChange(pageNum)}
                    className={`h-9 w-9 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isActive
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'bg-white text-ink-700 border border-ink-200 hover:bg-ink-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => handlePageChange(validCurrentPage + 1)}
              disabled={validCurrentPage >= totalPages}
              className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold text-ink-700 bg-white border border-ink-200 rounded-xl hover:bg-ink-50 disabled:opacity-40 disabled:pointer-events-none transition shadow-xs cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        )}
      </div>

      {/* ── 4. BOTTOM LUXURY HOLIDAY CTA BANNER ── */}
      {pageContent.bottom_cta && (
        <section className="container-page mt-20 px-4">
          <div className="relative overflow-hidden rounded-3xl bg-navy-950 text-white p-8 sm:p-12 lg:p-14 border border-white/10 shadow-2xl">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-2xl space-y-4">
              {pageContent.bottom_cta.badge && (
                <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sand-300 border border-white/20 shadow-xs">
                  <span>{pageContent.bottom_cta.badge}</span>
                </span>
              )}

              <h2 className="font-display text-2xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
                {pageContent.bottom_cta.title}
              </h2>

              {pageContent.bottom_cta.description && (
                <p className="text-sm sm:text-base text-white/80 font-light leading-relaxed">
                  {pageContent.bottom_cta.description}
                </p>
              )}

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <Link
                  href={pageContent.bottom_cta.button_link || '/booking'}
                  className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl shadow-lg cursor-pointer"
                >
                  <span>{pageContent.bottom_cta.button_text || 'Plan My Journey'}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-white/90 hover:text-white px-4 py-3 rounded-xl border border-white/20 hover:bg-white/10 transition cursor-pointer"
                >
                  <span>Talk with a Specialist</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
