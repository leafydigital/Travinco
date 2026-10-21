'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, X, MapPin, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { DestinationRowActions } from './destination-row-actions';
import type { ContentStatus } from '@/types/database';

export interface DestinationItem {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  description: string | null;
  cover_image_url: string | null;
  is_featured: boolean;
  status: ContentStatus;
  is_active?: boolean;
  is_deleted?: boolean;
}

interface DestinationsTableProps {
  initialDestinations: DestinationItem[];
  isAdmin: boolean;
}

export function DestinationsTable({
  initialDestinations,
  isAdmin,
}: DestinationsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredDestinations = useMemo(() => {
    let result = initialDestinations.filter((d) => d.is_deleted !== true);

    if (statusFilter && statusFilter !== 'all') {
      result = result.filter((d) => d.status === statusFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.slug.toLowerCase().includes(q) ||
          (d.country && d.country.toLowerCase().includes(q))
      );
    }

    return result;
  }, [initialDestinations, statusFilter, searchTerm]);

  const hasActiveFilters = Boolean(searchTerm.trim() || statusFilter !== 'all');

  function handleClearAll() {
    setSearchTerm('');
    setStatusFilter('all');
  }

  return (
    <div className="space-y-4">
      {/* 1. Search and Status Filter Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-ink-100 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            placeholder="Search destinations by name or country…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-ink-100 bg-ink-50/50 py-2 pl-9 pr-8 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 p-0.5 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 rounded-xl border border-ink-100 bg-ink-50/60 p-1">
            <SlidersHorizontal className="ml-1.5 h-3.5 w-3.5 text-ink-400" />
            {(['all', 'published', 'draft', 'archived'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
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
        </div>
      </div>

      {/* 2. Destinations Table */}
      <div className="card overflow-hidden">
        <div className="w-full">
          <table className="w-full text-sm table-auto">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="w-14 px-3 sm:px-4 py-3 font-semibold">Image</th>
                <th className="px-3 sm:px-4 py-3 font-semibold">Destination</th>
                <th className="px-3 sm:px-4 py-3 font-semibold">Country</th>
                <th className="px-3 sm:px-4 py-3 font-semibold">Featured</th>
                <th className="px-3 sm:px-4 py-3 font-semibold">Status</th>
                <th className="w-[1%] whitespace-nowrap px-3 sm:px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {filteredDestinations.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-ink-400">
                    <MapPin className="mx-auto h-8 w-8 text-ink-300 mb-2" />
                    <p className="font-medium text-ink-600">No destinations found</p>
                    <p className="text-xs text-ink-400 mt-1">
                      {hasActiveFilters
                        ? 'Try clearing or modifying your search filters.'
                        : 'No destinations have been added yet.'}
                    </p>
                  </td>
                </tr>
              )}

              {filteredDestinations.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50 transition-colors"
                >
                  <td className="w-14 px-3 sm:px-4 py-3">
                    <div className="relative h-10 w-12 overflow-hidden rounded-lg bg-ink-100 shadow-2xs">
                      {d.cover_image_url ? (
                        <Image
                          src={d.cover_image_url}
                          alt={d.name}
                          fill
                          className="object-cover"
                          sizes="48px"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-ink-300">
                          <MapPin className="h-4 w-4 opacity-40" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 py-3">
                    <Link
                      href={`/travinco_dashboard/destinations/${d.id}`}
                      className="font-medium text-ink-900 hover:text-brand-700 transition-colors line-clamp-1"
                    >
                      {d.name}
                    </Link>
                    <span className="text-xs text-ink-400 font-mono">{d.slug}</span>
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-ink-600">{d.country ?? '—'}</td>
                  <td className="px-3 sm:px-4 py-3">
                    {d.is_featured ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200/60">
                        Featured
                      </span>
                    ) : (
                      <span className="text-xs text-ink-400">Standard</span>
                    )}
                  </td>
                  <td className="px-3 sm:px-4 py-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="w-[1%] whitespace-nowrap px-3 sm:px-4 py-3 text-right">
                    <DestinationRowActions
                      id={d.id}
                      name={d.name}
                      status={d.status}
                      isActive={d.status === 'published'}
                      isAdmin={isAdmin}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
