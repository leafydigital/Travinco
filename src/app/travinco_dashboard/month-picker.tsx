'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const FIRST_YEAR = 2020;

const key = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;

/**
 * Month/year selector for the dashboard. Writes ?month=YYYY-MM; every dashboard
 * section reads it. Future months are disabled.
 */
export function MonthPicker({ value, currentMonth }: { value: string; currentMonth: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const [selYear, selMonth] = value.split('-').map(Number) as [number, number];
  const [maxYear, maxMonth] = currentMonth.split('-').map(Number) as [number, number];
  const [viewYear, setViewYear] = useState(selYear);

  useEffect(() => {
    if (!open) return;
    setViewYear(selYear);
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, selYear]);

  function go(y: number, m: number) {
    setOpen(false);
    const k = key(y, m);
    if (k === value) return;
    start(() => router.push(k === currentMonth ? pathname : `${pathname}?month=${k}`));
  }

  function step(delta: number) {
    const d = new Date(Date.UTC(selYear, selMonth - 1 + delta, 1));
    go(d.getUTCFullYear(), d.getUTCMonth() + 1);
  }

  const isFuture = (y: number, m: number) => y > maxYear || (y === maxYear && m > maxMonth);
  const atStart = selYear === FIRST_YEAR && selMonth === 1;
  const atEnd = selYear === maxYear && selMonth === maxMonth;

  return (
    <div ref={ref} className="relative flex items-center gap-1">
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={atStart || pending}
        className="rounded-lg border border-ink-200 bg-white p-1.5 text-ink-500 shadow-xs hover:bg-ink-50 hover:text-ink-800 disabled:opacity-40"
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-w-[10.5rem] items-center justify-between gap-2 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm font-medium text-ink-700 shadow-xs hover:border-brand-300 hover:bg-brand-50/40"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2">
          {pending ? <Loader2 className="h-4 w-4 animate-spin text-brand-600" /> : <Calendar className="h-4 w-4 text-brand-600" />}
          {FULL_MONTHS[selMonth - 1]} {selYear}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-ink-400 transition-transform', open && 'rotate-180')} />
      </button>

      <button
        type="button"
        onClick={() => step(1)}
        disabled={atEnd || pending}
        className="rounded-lg border border-ink-200 bg-white p-1.5 text-ink-500 shadow-xs hover:bg-ink-50 hover:text-ink-800 disabled:opacity-40"
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {open && (
        <div role="dialog" aria-label="Choose month" className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border border-ink-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              disabled={viewYear <= FIRST_YEAR}
              className="rounded-md p-1 text-ink-500 hover:bg-ink-100 disabled:opacity-30"
              aria-label="Previous year"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-ink-900">{viewYear}</span>
            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              disabled={viewYear >= maxYear}
              className="rounded-md p-1 text-ink-500 hover:bg-ink-100 disabled:opacity-30"
              aria-label="Next year"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS.map((label, i) => {
              const m = i + 1;
              const selected = viewYear === selYear && m === selMonth;
              const future = isFuture(viewYear, m);
              return (
                <button
                  key={label}
                  type="button"
                  disabled={future}
                  onClick={() => go(viewYear, m)}
                  className={cn(
                    'rounded-lg px-2 py-2 text-xs font-medium transition-colors',
                    selected
                      ? 'bg-brand-600 text-white'
                      : future
                        ? 'cursor-not-allowed text-ink-300'
                        : 'text-ink-700 hover:bg-brand-50 hover:text-brand-800',
                    !selected && viewYear === maxYear && m === maxMonth && 'ring-1 ring-brand-300'
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {value !== currentMonth && (
            <button
              type="button"
              onClick={() => go(maxYear, maxMonth)}
              className="mt-2 w-full rounded-lg py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
            >
              Back to this month
            </button>
          )}
        </div>
      )}
    </div>
  );
}
