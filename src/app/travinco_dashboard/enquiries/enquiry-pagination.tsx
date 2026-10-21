'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown } from 'lucide-react';

interface Props {
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

export function EnquiryPagination({ totalCount, currentPage, pageSize }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startRow = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(currentPage * pageSize, totalCount);

  function createPageURL(page: number, newPageSize?: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    if (newPageSize) {
      params.set('limit', String(newPageSize));
    }
    return `${pathname}?${params.toString()}`;
  }

  function handlePageSizeChange(newSize: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('limit', String(newSize));
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  }

  function getPageNumbers(): (number | string)[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-ink-100 bg-white px-5 py-3 text-xs text-ink-600">
      {/* Left: Row info + Rows Per Page Dropdown */}
      <div className="flex flex-wrap items-center gap-4">
        <span>
          Showing <span className="font-semibold text-ink-800">{startRow}</span> to{' '}
          <span className="font-semibold text-ink-800">{endRow}</span> of{' '}
          <span className="font-semibold text-ink-800">{totalCount}</span> entries
        </span>

        <div className="flex items-center gap-2">
          <label htmlFor="pageSizeSelect" className="text-ink-500">
            Rows per page:
          </label>
          <div className="relative inline-flex items-center">
            <select
              id="pageSizeSelect"
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="appearance-none rounded-lg border border-ink-200 bg-white pl-2.5 pr-7 py-1 text-xs font-semibold text-ink-800 shadow-2xs hover:border-ink-300 focus:border-brand-500 focus:outline-none cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-ink-400" />
          </div>
        </div>
      </div>

      {/* Right: Page Navigation Buttons */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          type="button"
          onClick={() => router.push(createPageURL(1))}
          disabled={currentPage <= 1}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-ink-200 text-ink-600 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
          title="First Page"
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          onClick={() => router.push(createPageURL(currentPage - 1))}
          disabled={currentPage <= 1}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-ink-200 text-ink-600 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
          title="Previous Page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        {/* Numbered Page Buttons */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((p, idx) => {
            if (typeof p === 'string') {
              return (
                <span key={`ellipsis-${idx}`} className="px-1 text-ink-400">
                  …
                </span>
              );
            }
            const isActive = p === currentPage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => router.push(createPageURL(p))}
                className={`flex h-7 min-w-[28px] items-center justify-center rounded-md px-2 text-xs transition ${
                  isActive
                    ? 'bg-brand-600 font-semibold text-white shadow-xs'
                    : 'border border-ink-200 text-ink-700 hover:bg-ink-50'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          onClick={() => router.push(createPageURL(currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-ink-200 text-ink-600 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
          title="Next Page"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        {/* Last Page */}
        <button
          type="button"
          onClick={() => router.push(createPageURL(totalPages))}
          disabled={currentPage >= totalPages}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-ink-200 text-ink-600 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
          title="Last Page"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
