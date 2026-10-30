'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

/** Page numbers to show: first, last, current ±1, with gaps marked as null. */
function pageList(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push(null);
    out.push(p);
  });
  return out;
}

/**
 * Pagination bar for public lists: "Showing x to y of z", a rows-per-page selector
 * (10 / 20 / 50) and page buttons. Renders nothing for an empty list.
 */
export function ListPagination({
  page,
  pageSize,
  totalItems,
  itemLabel,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  /** Plural noun for the summary, e.g. "packages" */
  itemLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  if (totalItems === 0) return null;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col items-center justify-between gap-4 border-t border-ink-200 pt-6 sm:flex-row">
      <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-medium text-ink-500">
        <p>
          Showing <span className="font-bold text-ink-900">{first}</span> to{' '}
          <span className="font-bold text-ink-900">{last}</span> of{' '}
          <span className="font-bold text-ink-900">{totalItems}</span> {itemLabel}
        </p>
        <label className="inline-flex items-center gap-1.5">
          <span>Rows</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-ink-200 bg-white py-1 pl-2 pr-7 text-xs font-semibold text-ink-700 shadow-xs focus:border-brand-500 focus:ring-brand-500"
            aria-label="Rows per page"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="inline-flex flex-wrap items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-700 shadow-xs transition hover:bg-ink-50 disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </button>

          {pageList(page, totalPages).map((p, i) =>
            p === null ? (
              <span key={`gap-${i}`} className="px-1 text-xs text-ink-400">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className={`h-9 min-w-[36px] cursor-pointer rounded-xl px-2 text-xs font-bold shadow-xs transition ${
                  p === page
                    ? 'bg-brand-600 text-white shadow-brand-600/25'
                    : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
                }`}
              >
                {p}
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-700 shadow-xs transition hover:bg-ink-50 disabled:pointer-events-none disabled:opacity-40"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}
    </div>
  );
}
