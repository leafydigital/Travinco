'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, X, SlidersHorizontal, RotateCcw, Package } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/utils/format';
import { PackageRowActions } from './package-row-actions';

export interface PackageItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  base_price: number;
  discount_price: number | null;
  currency: string;
  duration_days: number;
  duration_nights: number;
  cover_image_url: string | null;
  is_featured: boolean;
  destination_id: string | null;
  is_deleted?: boolean;
}

import type { DestinationOption } from './bulk-create-modal';

interface Props {
  initialPackages: PackageItem[];
  destinationsMap: Record<string, string>;
  destinations?: DestinationOption[];
  isAdmin: boolean;
}

const PAGE_SIZE = 15;

export function PackagesTable({
  initialPackages,
  destinationsMap,
  destinations = [],
  isAdmin,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Instant in-memory filtering (0ms latency!)
  const filteredPackages = useMemo(() => {
    let result = initialPackages.filter((pkg) => pkg.is_deleted !== true);

    if (statusFilter && statusFilter !== 'all') {
      result = result.filter((pkg) => pkg.status === statusFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter((pkg) => {
        const destName = pkg.destination_id ? destinationsMap[pkg.destination_id]?.toLowerCase() ?? '' : '';
        return (
          pkg.title.toLowerCase().includes(q) ||
          destName.includes(q) ||
          pkg.slug.toLowerCase().includes(q)
        );
      });
    }

    return result;
  }, [initialPackages, destinationsMap, statusFilter, searchTerm]);

  // Pagination calculation
  const totalItems = filteredPackages.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const paginatedPackages = filteredPackages.slice(startIndex, startIndex + PAGE_SIZE);

  function handleSearchChange(val: string) {
    setSearchTerm(val);
    setCurrentPage(1);
  }

  function handleStatusChange(val: string) {
    setStatusFilter(val);
    setCurrentPage(1);
  }

  function handleClearAll() {
    setSearchTerm('');
    setStatusFilter('all');
    setCurrentPage(1);
  }

  const hasActiveFilters = Boolean(searchTerm.trim() || statusFilter !== 'all');

  return (
    <div className="space-y-4">
      {/* 1. Fast Client Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0 sm:min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by package name or destination…"
            className="input pl-9 pr-8 text-sm w-full"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => handleSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-400 hover:text-ink-700"
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
              className="inline-flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-brand-700 transition px-2 py-1.5 whitespace-nowrap"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Packages Table */}
      <div className="card overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm table-auto">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
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
              {paginatedPackages.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-ink-400">
                    <Package className="mx-auto h-8 w-8 text-ink-300 mb-2" />
                    <p className="font-medium text-ink-600">No packages found</p>
                    <p className="text-xs text-ink-400 mt-1">
                      {hasActiveFilters
                        ? 'Try clearing or modifying your search filters.'
                        : 'No active packages in the system.'}
                    </p>
                  </td>
                </tr>
              )}
              {paginatedPackages.map((pkg) => (
                <tr key={pkg.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50 transition-colors">
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
                  <td className="px-3 sm:px-4 py-3">
                    <Link
                      href={`/travinco_dashboard/packages/${pkg.id}`}
                      className="font-medium text-ink-900 hover:text-brand-700 transition-colors line-clamp-1"
                    >
                      {pkg.title}
                    </Link>
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-ink-600">
                    {pkg.destination_id ? destinationsMap[pkg.destination_id] ?? '—' : '—'}
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-ink-600 whitespace-nowrap">
                    {pkg.duration_days}D / {pkg.duration_nights}N
                  </td>
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
                  <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={pkg.status} />
                  </td>
                  <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                    {pkg.is_featured ? (
                      <span className="badge badge-accent">Featured</span>
                    ) : (
                      <span className="text-xs text-ink-300">—</span>
                    )}
                  </td>
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

        {/* 3. Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3 text-sm text-ink-500">
            <span>
              Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, totalItems)} of {totalItems} packages
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
                className="btn-outline px-3 py-1.5 text-xs font-medium disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="btn-outline px-3 py-1.5 text-xs font-medium disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
