'use client';

import { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X, BookOpen, RotateCcw, ChevronLeft, ChevronRight, Loader2, SlidersHorizontal } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate } from '@/lib/utils/format';
import { BlogPostRowActions } from './blog-post-row-actions';
import type { BlogTableItem } from './actions';

interface BlogTableProps {
  posts?: BlogTableItem[];
  totalCount?: number;
  totalPages?: number;
  currentPage?: number;
  pageSize?: number;
  isAdmin: boolean;
  initialSearch?: string;
  initialStatus?: string;
}

export function BlogTable({
  posts = [],
  totalCount = 0,
  totalPages = 1,
  currentPage = 1,
  pageSize = 20,
  isAdmin,
  initialSearch = '',
  initialStatus = 'all',
}: BlogTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatus);

  useEffect(() => {
    setSearchTerm(searchParams.get('q') ?? '');
    setStatusFilter(searchParams.get('status') ?? 'all');
  }, [searchParams]);

  function updateParams(newParams: Record<string, string | null | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([key, val]) => {
      if (val === null || val === undefined || val === '' || val === 'all') {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    });

    if ('q' in newParams || 'status' in newParams) {
      params.delete('page');
    }

    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ q: searchTerm.trim() });
  }

  function handleStatusChange(newStatus: string) {
    setStatusFilter(newStatus);
    updateParams({ status: newStatus });
  }

  function handleClearAll() {
    setSearchTerm('');
    setStatusFilter('all');
    startTransition(() => {
      router.push('?');
    });
  }

  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return;
    updateParams({ page: String(page) });
  }

  const hasActiveFilters = Boolean(searchTerm.trim() || (statusFilter && statusFilter !== 'all'));
  const startIndex = (currentPage - 1) * pageSize;

  return (
    <div className="space-y-4">
      {/* 1. Search and Status Filter Bar */}
      <form
        onSubmit={handleSearchSubmit}
        className="flex flex-col gap-3 rounded-2xl border border-ink-100 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            placeholder="Search posts by title or slug…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onBlur={() => updateParams({ q: searchTerm.trim() })}
            className="w-full rounded-xl border border-ink-100 bg-ink-50/50 py-2 pl-9 pr-8 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                updateParams({ q: '' });
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 p-0.5 cursor-pointer"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 rounded-xl border border-ink-100 bg-ink-50/60 p-1">
            <SlidersHorizontal className="ml-1.5 h-3.5 w-3.5 text-ink-400" />
            {(['all', 'published', 'draft', 'archived'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => handleStatusChange(st)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-ink-900 shadow-2xs'
                    : 'text-ink-500 hover:text-ink-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-brand-700 transition px-2 py-1.5 whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Clear</span>
            </button>
          )}

          {isPending && (
            <Loader2 className="h-4 w-4 animate-spin text-brand-600 shrink-0 ml-1" />
          )}
        </div>
      </form>

      {/* 2. Blog Table */}
      <div className="card overflow-hidden">
        <div className="w-full">
          <table className="w-full text-sm table-auto">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400 bg-sand-50/40">
                <th className="w-16 px-3 sm:px-4 py-3 font-semibold">Image</th>
                <th className="px-3 sm:px-4 py-3 font-semibold">Title</th>
                <th className="px-3 sm:px-4 py-3 font-semibold">Created</th>
                <th className="px-3 sm:px-4 py-3 font-semibold">Status</th>
                <th className="w-[1%] whitespace-nowrap px-3 sm:px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {posts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-ink-400">
                    <BookOpen className="mx-auto h-8 w-8 text-ink-300 mb-2" />
                    <p className="font-medium text-ink-600">No blog posts found</p>
                    <p className="text-xs text-ink-400 mt-1">
                      {hasActiveFilters
                        ? 'Try clearing or modifying your search filters.'
                        : 'No blog posts have been created yet.'}
                    </p>
                  </td>
                </tr>
              )}

              {posts.map((post) => (
                <tr
                  key={post.id}
                  className="border-b border-ink-50 last:border-0 hover:bg-sand-50/40 transition-colors"
                >
                  {/* 1. Image */}
                  <td className="w-16 px-3 sm:px-4 py-3">
                    <div className="relative h-11 w-14 overflow-hidden rounded-lg bg-ink-100 border border-ink-200/50 shadow-2xs">
                      {post.cover_image_url ? (
                        <Image
                          src={post.cover_image_url}
                          alt={post.title}
                          fill
                          className="object-cover"
                          sizes="56px"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-ink-300">
                          No image
                        </div>
                      )}
                    </div>
                  </td>

                  {/* 2. Title */}
                  <td className="px-3 sm:px-4 py-3">
                    <Link
                      href={`/travinco_dashboard/blog/${post.id}`}
                      prefetch={true}
                      className="font-medium text-ink-900 hover:text-brand-700 hover:underline transition-colors line-clamp-1"
                      title={post.title}
                    >
                      {post.title}
                    </Link>
                    <span className="text-xs text-ink-400 font-mono line-clamp-1">{post.slug}</span>
                  </td>

                  {/* 3. Created */}
                  <td className="px-3 sm:px-4 py-3 text-ink-500 whitespace-nowrap text-xs sm:text-sm">
                    {formatDate(post.created_at)}
                  </td>

                  {/* 4. Status */}
                  <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={post.status} />
                  </td>

                  {/* 5. Actions */}
                  <td className="w-[1%] whitespace-nowrap px-3 sm:px-4 py-3 text-right">
                    <BlogPostRowActions
                      id={post.id}
                      title={post.title}
                      status={post.status}
                      isAdmin={isAdmin}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 3. Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-ink-100 px-5 py-3 text-sm text-ink-500 gap-3">
            <span>
              Showing <span className="font-semibold text-ink-800">{startIndex + 1}</span>–
              <span className="font-semibold text-ink-800">
                {Math.min(startIndex + pageSize, totalCount)}
              </span> of <span className="font-semibold text-ink-800">{totalCount}</span> posts
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1 || isPending}
                className="btn-outline px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Previous</span>
              </button>

              <span className="px-2 text-xs font-medium text-ink-600">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages || isPending}
                className="btn-outline px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
