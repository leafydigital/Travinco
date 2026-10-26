'use client';

import { useState, useEffect, useTransition, useId } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { STATUS_OPTIONS } from './lead-row-actions';

interface Props {
  initialSearch?: string;
  initialStatus?: string;
  initialLimit?: number;
}

export function LeadsFilterBar({
  initialSearch = '',
  initialStatus = '',
  initialLimit = 20,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const searchInputId = useId();
  const statusSelectId = useId();
  const limitSelectId = useId();

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [statusValue, setStatusValue] = useState(searchParams.get('status') ?? initialStatus);
  const [limitValue, setLimitValue] = useState(searchParams.get('limit') ?? String(initialLimit));

  // Sync state if URL changes externally (e.g. back button or dashboard card click)
  useEffect(() => {
    setStatusValue(searchParams.get('status') ?? '');
    setLimitValue(searchParams.get('limit') ?? String(initialLimit));
    setSearchTerm(searchParams.get('q') ?? '');
  }, [searchParams, initialLimit]);

  function updateParams(newParams: Record<string, string | null | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([key, val]) => {
      if (val === null || val === undefined || val === '') {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    });
    // When changing search, status, or limit, always reset page to 1
    if ('q' in newParams || 'status' in newParams || 'limit' in newParams) {
      params.set('page', '1');
    }
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ q: searchTerm.trim() });
  }

  function handleStatusChange(status: string) {
    setStatusValue(status); // Instant local update (0ms lag!)
    updateParams({ status: status || null });
  }

  function handleLimitChange(limit: string) {
    setLimitValue(limit); // Instant local update!
    updateParams({ limit });
  }

  function handleClearAll() {
    setSearchTerm('');
    setStatusValue('');
    const params = new URLSearchParams();
    router.push(`?${params.toString()}`);
  }

  const hasActiveFilters = Boolean(searchTerm || statusValue || searchParams.get('page'));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search input */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            id={searchInputId}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search name, phone, email, package..."
            className="input pl-9 pr-8 text-sm"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                updateParams({ q: null });
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-400 hover:text-ink-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>

        {/* Status Dropdown Filter */}
        <div className="flex items-center gap-2">
          <label htmlFor={statusSelectId} className="sr-only">Status</label>
          <select
            id={statusSelectId}
            value={statusValue}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="input w-auto min-w-[160px] pr-8 text-sm font-medium cursor-pointer"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Rows Per Page Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor={limitSelectId} className="flex items-center gap-1.5 text-xs text-ink-500 whitespace-nowrap">
            <SlidersHorizontal className="h-3.5 w-3.5 text-ink-400" />
            <span>Rows:</span>
          </label>
          <select
            id={limitSelectId}
            value={limitValue}
            onChange={(e) => handleLimitChange(e.target.value)}
            className="input w-auto min-w-[75px] pr-7 text-sm cursor-pointer"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs font-medium text-ink-500 hover:text-brand-700 transition"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
