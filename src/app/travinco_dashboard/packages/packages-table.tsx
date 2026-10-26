'use client';

import { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X, RotateCcw, Package, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/utils/format';
import { PackageRowActions } from './package-row-actions';
import type { PackageTableItem } from './actions';

export type PackageItem = PackageTableItem;

interface Props {
  packages: PackageTableItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  isAdmin: boolean;
  initialSearch?: string;
  initialStatus?: string;
}

export function PackagesTable({
  packages = [],
  totalCount = 0,
  totalPages = 1,
  currentPage = 1,
  pageSize = 20,
  isAdmin,
  initialSearch = '',
  initialStatus = 'all',
}: Props) {
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
      {/* 1. Fast Filter & Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0 sm:min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onBlur={() => updateParams({ q: searchTerm.trim() })}
            placeholder="Search by package name or slug…"
            className="input pl-9 pr-8 text-sm w-full"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                updateParams({ q: '' });
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-400 hover:text-ink-700 cursor-pointer"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status Dropdown & Clear */}
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="input flex-1 sm:flex-initial sm:w-auto min-w-[140px] pr-8 text-sm font-medium cursor-pointer"
          >
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>

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

      {/* 2. Packages Table */}
      <div className="card overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm table-auto">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400 bg-sand-50/40">
                <th className="w-14 px-3 sm:px-4 py-3 font-semibold">Image</th>
                <th className="px-3 sm:px-4 py-3 font-semibold">Package</th>
                <th className="px-3 sm:px-4 py-3 font-semibold">Destination</th>
                <th className="px-3 sm:px-4 py-3 font-semibold">Duration</th>
                <th className="px-3 sm:px-4 py-3 font-semibold">Price</th>
                <th className="px-3 sm:px-4 py-3 font-semibold">Status</th>
                <th className="px-3 sm:px-4 py-3 font-semibold">Featured</th>
                <th className="w-[1%] whitespace-nowrap px-3 sm:px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {packages.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-ink-400">
                    <Package className="mx-auto h-8 w-8 text-ink-300 mb-2" />
                    <p className="font-medium text-ink-600">No packages found</p>
                    <p className="text-xs text-ink-400 mt-1">
                      {hasActiveFilters
                        ? 'Try modifying your search or status filter.'
                        : 'No active packages in the system.'}
                    </p>
                  </td>
                </tr>
              )}
              {packages.map((pkg) => (
                <tr key={pkg.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50 transition-colors">
                  {/* 1. Image */}
                  <td className="w-14 px-3 sm:px-4 py-3">
                    <div className="relative h-10 w-12 overflow-hidden rounded-lg bg-ink-100 shadow-2xs">
                      {pkg.cover_image_url ? (
                        <Image
                          src={pkg.cover_image_url}
                          alt={pkg.title}
                          fill
                          className="object-cover"
                          sizes="48px"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-ink-300">
                          No image
                        </div>
                      )}
                    </div>
                  </td>

                  {/* 2. Package */}
                  <td className="px-3 sm:px-4 py-3">
                    <Link
                      href={`/travinco_dashboard/packages/${pkg.id}`}
                      prefetch={true}
                      className="font-medium text-ink-900 hover:text-brand-700 transition-colors line-clamp-1"
                      title={pkg.title}
                    >
                      {pkg.title}
                    </Link>
                  </td>

                  {/* 3. Destination */}
                  <td className="px-3 sm:px-4 py-3 text-ink-600 whitespace-nowrap">
                    {pkg.destination_name || '—'}
                  </td>

                  {/* 4. Duration */}
                  <td className="px-3 sm:px-4 py-3 text-ink-600 whitespace-nowrap">
                    {pkg.duration_days}D / {pkg.duration_nights}N
                  </td>

                  {/* 5. Price */}
                  <td className="px-3 sm:px-4 py-3 text-ink-700 whitespace-nowrap">
                    {pkg.discount_price ? (
                      <div>
                        <span className="font-semibold text-brand-700">
                          {formatCurrency(pkg.discount_price, pkg.currency)}
                        </span>
                        <span className="ml-1.5 text-xs text-ink-400 line-through">
                          {formatCurrency(pkg.base_price, pkg.currency)}
                        </span>
                      </div>
                    ) : (
                      <span className="font-semibold text-ink-900">
                        {formatCurrency(pkg.base_price, pkg.currency)}
                      </span>
                    )}
                  </td>

                  {/* 6. Status */}
                  <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={pkg.status} />
                  </td>

                  {/* 7. Featured */}
                  <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                    {pkg.is_featured ? (
                      <span className="badge badge-accent">Featured</span>
                    ) : (
                      <span className="text-xs text-ink-300">—</span>
                    )}
                  </td>

                  {/* 8. Actions */}
                  <td className="w-[1%] whitespace-nowrap px-3 sm:px-4 py-3 text-right">
                    <PackageRowActions
                      id={pkg.id}
                      title={pkg.title}
                      status={pkg.status}
                      isFeatured={Boolean(pkg.is_featured)}
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
              </span> of <span className="font-semibold text-ink-800">{totalCount}</span> packages
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
