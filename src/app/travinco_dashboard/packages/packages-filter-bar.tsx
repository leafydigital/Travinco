'use client';

import { useState, useEffect, useTransition, useId } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X, SlidersHorizontal, RotateCcw } from 'lucide-react';

interface Props {
  initialSearch?: string;
  initialStatus?: string;
}

export function PackagesFilterBar({
  initialSearch = '',
  initialStatus = 'all',
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const searchInputId = useId();
  const statusSelectId = useId();

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [statusValue, setStatusValue] = useState(searchParams.get('status') ?? initialStatus);

  // Sync state if URL changes externally (e.g. browser back/forward)
  useEffect(() => {
    setStatusValue(searchParams.get('status') ?? 'all');
    setSearchTerm(searchParams.get('q') ?? '');
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

    // Reset pagination when searching or filtering
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
    setStatusValue(newStatus);
    updateParams({ status: newStatus });
  }

  function handleClearAll() {
    setSearchTerm('');
    setStatusValue('all');
    startTransition(() => {
      router.push('/travinco_dashboard/packages');
    });
  }

  const hasActiveFilters = Boolean(
    searchTerm ||
    (statusValue && statusValue !== 'all') ||
    searchParams.get('page')
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search Input */}
      <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[240px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          id={searchInputId}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by package name or keyword…"
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
            title="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </form>

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <label htmlFor={statusSelectId} className="sr-only">Filter by status</label>
        <select
          id={statusSelectId}
          value={statusValue}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="input w-auto min-w-[145px] pr-8 text-sm font-medium cursor-pointer"
        >
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Submit Filter Button */}
      <button
        type="button"
        onClick={() => updateParams({ q: searchTerm.trim() })}
        disabled={isPending}
        className="btn-outline text-xs px-3.5 py-2 font-medium"
      >
        <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5 text-ink-400" />
        {isPending ? 'Filtering…' : 'Filter'}
      </button>

      {/* Clear Filters Reset */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleClearAll}
          className="inline-flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-brand-700 transition"
        >
          <RotateCcw className="h-3 w-3" />
          Clear filters
        </button>
      )}
    </div>
  );
}
