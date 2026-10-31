'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Date picker that always displays DD/MM/YYYY (the native <input type="date">
 * follows the device locale, e.g. MM/DD/YYYY on US devices, and can't be forced).
 *
 * Value in/out is ISO `YYYY-MM-DD` (same as the native input), so form
 * submission and server validation are unchanged. Dates outside [min, max]
 * are disabled and can't be picked; there is no free-text entry.
 *
 * Desktop: a calendar popover under (or above) the field.
 * Phones: a bottom sheet, so it is never clipped by a modal or the screen edge.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const DEFAULT_MIN = '1900-01-01';
const DEFAULT_MAX = '2100-12-31';
const POPOVER_WIDTH = 304;
const POPOVER_HEIGHT = 392;
const SHEET_BREAKPOINT = 640;

function toIso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseIso(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

function todayIsoLocal() {
  const now = new Date();
  return toIso(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Where the calendar opens with no date picked: today, kept inside [min, max]. */
function initialView(value: string, min: string, max: string) {
  const picked = parseIso(value);
  if (picked) return picked;
  const today = todayIsoLocal();
  return parseIso(today < min ? min : today > max ? max : today)!;
}

export function formatIsoAsDMY(iso: string): string {
  const p = parseIso(iso);
  if (!p) return '';
  return `${String(p.d).padStart(2, '0')}/${String(p.m + 1).padStart(2, '0')}/${p.y}`;
}

type Placement = { sheet: boolean; top: number; left: number; openUp: boolean };

export function DatePickerDMY({
  name,
  value,
  onChange,
  onClose,
  min = DEFAULT_MIN,
  max = DEFAULT_MAX,
  invalid = false,
  disabled = false,
  clearable = false,
  required = false,
  size = 'md',
  placeholder = 'DD/MM/YYYY',
  label = 'Choose date',
  id,
  className = '',
}: {
  name?: string;
  /** ISO YYYY-MM-DD or '' */
  value: string;
  onChange: (iso: string) => void;
  /** Called when the calendar closes (acts like blur for validation). */
  onClose?: () => void;
  /** ISO YYYY-MM-DD, inclusive */
  min?: string;
  /** ISO YYYY-MM-DD, inclusive */
  max?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** Shows a clear (×) button when a date is set. */
  clearable?: boolean;
  /** Blocks native form submission while empty (only with `name`). */
  required?: boolean;
  /** 'sm' matches compact h-8 admin inputs. */
  size?: 'sm' | 'md';
  placeholder?: string;
  /** Accessible name of the calendar dialog. */
  label?: string;
  id?: string;
  className?: string;
}) {
  const minP = parseIso(min) ?? parseIso(DEFAULT_MIN)!;
  const maxP = parseIso(max) ?? parseIso(DEFAULT_MAX)!;

  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const base = initialView(value, min, max);
    return { y: base.y, m: base.m };
  });
  const [placement, setPlacement] = useState<Placement>({ sheet: false, top: 0, left: 0, openUp: false });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const today = todayIsoLocal();

  /** Positions the calendar against the viewport, so scrolling modals can't clip it. */
  function measure() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (vw < SHEET_BREAKPOINT) {
      setPlacement({ sheet: true, top: 0, left: 0, openUp: false });
      return;
    }
    const spaceBelow = vh - rect.bottom;
    const openUp = spaceBelow < POPOVER_HEIGHT + 8 && rect.top > spaceBelow;
    const left = Math.min(Math.max(8, rect.left), vw - POPOVER_WIDTH - 8);
    const top = openUp ? rect.top - 6 : rect.bottom + 6;
    setPlacement({ sheet: false, top, left, openUp });
  }

  function openCalendar() {
    if (disabled) return;
    measure();
    setOpen(true);
  }

  function close() {
    setOpen(false);
    onClose?.();
  }

  // Re-centre the calendar on the selected date (or today) each time it opens
  useEffect(() => {
    if (!open) return;
    const base = initialView(value, min, max);
    setView({ y: base.y, m: base.m });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the popover attached to the field while the page or a modal scrolls
  useLayoutEffect(() => {
    if (!open) return;
    const onMove = () => measure();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapperRef.current?.contains(t) || popRef.current?.contains(t)) return;
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        close();
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const monthIndex = (y: number, m: number) => y * 12 + m;
  const minMonth = monthIndex(minP.y, minP.m);
  const maxMonth = monthIndex(maxP.y, maxP.m);
  const viewMonth = monthIndex(view.y, view.m);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = minP.y; y <= maxP.y; y++) list.push(y);
    return list;
  }, [minP.y, maxP.y]);

  // Monday-first grid, always 6 rows so the calendar doesn't jump in height
  const firstWeekday = (new Date(view.y, view.m, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length < 42) cells.push(null);

  function setMonth(y: number, m: number) {
    const idx = Math.min(Math.max(monthIndex(y, m), minMonth), maxMonth);
    setView({ y: Math.floor(idx / 12), m: idx % 12 });
  }

  function pick(iso: string) {
    // onChange validates the new value itself; onClose is only for
    // dismissing without a pick (it would see the previous value here).
    onChange(iso);
    setOpen(false);
    triggerRef.current?.focus();
  }

  const todayPickable = today >= min && today <= max;
  const sm = size === 'sm';
  const showClear = clearable && Boolean(value) && !disabled;

  const calendar = (
    <div
      ref={popRef}
      role="dialog"
      aria-label={label}
      className={cn(
        'z-[1000] bg-white p-3 text-ink-800',
        placement.sheet
          ? 'fixed inset-x-0 bottom-0 rounded-t-2xl border-t border-ink-100 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl tv-sheet-in'
          : 'fixed rounded-2xl border border-ink-100 shadow-xl ring-1 ring-black/5 tv-pop-in'
      )}
      style={
        placement.sheet
          ? undefined
          : {
              width: POPOVER_WIDTH,
              left: placement.left,
              top: placement.top,
              transform: placement.openUp ? 'translateY(-100%)' : undefined,
            }
      }
    >
      {placement.sheet && <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink-200" aria-hidden />}

      {/* Month / year controls */}
      <div className="mb-3 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setMonth(view.y, view.m - 1)}
          disabled={viewMonth <= minMonth}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-ink-100 disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
          <select
            value={view.m}
            onChange={(e) => setMonth(view.y, Number(e.target.value))}
            className="min-w-0 cursor-pointer rounded-lg border-0 bg-transparent py-1 pl-2 pr-7 text-sm font-semibold text-ink-900 hover:bg-ink-50 focus:ring-2 focus:ring-brand-500 bg-[length:1rem_1rem] bg-[right_0.35rem_center]"
            aria-label="Month"
          >
            {MONTHS.map((monthLabel, m) => {
              const idx = monthIndex(view.y, m);
              return (
                <option key={monthLabel} value={m} disabled={idx < minMonth || idx > maxMonth}>
                  {placement.sheet ? monthLabel : MONTHS_SHORT[m]}
                </option>
              );
            })}
          </select>
          <select
            value={view.y}
            onChange={(e) => setMonth(Number(e.target.value), view.m)}
            className="cursor-pointer rounded-lg border-0 bg-transparent py-1 pl-2 pr-7 text-sm font-semibold text-ink-900 hover:bg-ink-50 focus:ring-2 focus:ring-brand-500 bg-[length:1rem_1rem] bg-[right_0.35rem_center]"
            aria-label="Year"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setMonth(view.y, view.m + 1)}
          disabled={viewMonth >= maxMonth}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-ink-100 disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-400">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={cn('py-1', i >= 5 && 'text-coral-400')}>
            {d}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-y-1 text-center text-sm">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} className={placement.sheet ? 'h-11' : 'h-9'} />;
          const iso = toIso(view.y, view.m, day);
          const isDisabled = iso < min || iso > max;
          const isSelected = iso === value;
          const isToday = iso === today;
          return (
            <div key={iso} className="flex items-center justify-center">
              <button
                type="button"
                disabled={isDisabled}
                onClick={() => pick(iso)}
                className={cn(
                  'relative flex items-center justify-center rounded-full tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                  placement.sheet ? 'h-11 w-11 text-base' : 'h-9 w-9',
                  isSelected
                    ? 'bg-brand-600 font-semibold text-white shadow-sm hover:bg-brand-700'
                    : isDisabled
                      ? 'cursor-not-allowed text-ink-300'
                      : 'text-ink-700 hover:bg-brand-50 hover:text-brand-800',
                  isToday && !isSelected && 'font-semibold text-brand-700 ring-1 ring-inset ring-brand-300'
                )}
                aria-label={formatIsoAsDMY(iso)}
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
              >
                {day}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-100 pt-3">
        <button
          type="button"
          onClick={() => pick(today)}
          disabled={!todayPickable}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          Today
        </button>
        <div className="flex items-center gap-1">
          {clearable && value && (
            <button
              type="button"
              data-no-confirm-save="true"
              onClick={() => pick('')}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={close}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div ref={wrapperRef} className="relative w-full">
      {name && (
        // Visually hidden but focusable by the browser, so `required` blocks an empty submit
        <input
          tabIndex={-1}
          aria-hidden
          name={name}
          value={value}
          autoComplete="off"
          required={required}
          onChange={() => {}}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full opacity-0"
        />
      )}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : openCalendar())}
        className={cn(
          'group flex w-full items-center gap-2 rounded-lg border bg-white text-left shadow-sm transition-colors',
          'focus:outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/30',
          sm ? 'h-8 px-2 text-xs' : 'h-10 px-3 text-sm',
          showClear && (sm ? 'pr-7' : 'pr-9'),
          invalid
            ? 'border-red-400 bg-red-50/40 focus-visible:border-red-500 focus-visible:ring-red-500/30'
            : open
              ? 'border-brand-500 ring-2 ring-brand-500/20'
              : 'border-ink-200 hover:border-ink-300',
          disabled && 'cursor-not-allowed bg-ink-50 text-ink-400 opacity-70 hover:border-ink-200',
          className
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid}
        aria-label={value ? `${label}: ${formatIsoAsDMY(value)}` : label}
      >
        <CalendarDays
          className={cn(
            'shrink-0 transition-colors',
            sm ? 'h-3.5 w-3.5' : 'h-4 w-4',
            invalid ? 'text-red-500' : value || open ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-500'
          )}
        />
        <span
          className={cn(
            'min-w-0 flex-1 truncate leading-none tabular-nums',
            value ? 'font-medium text-ink-900' : 'text-ink-400'
          )}
        >
          {value ? formatIsoAsDMY(value) : placeholder}
        </span>
        {!showClear && (
          <ChevronDown
            className={cn(
              'shrink-0 text-ink-400 transition-transform duration-150',
              sm ? 'h-3.5 w-3.5' : 'h-4 w-4',
              open && 'rotate-180'
            )}
          />
        )}
      </button>

      {showClear && (
        <button
          type="button"
          data-no-confirm-save="true"
          onClick={() => {
            onChange('');
            triggerRef.current?.focus();
          }}
          className={cn(
            'absolute top-1/2 -translate-y-1/2 rounded-full text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700',
            sm ? 'right-1.5 p-0.5' : 'right-2 p-1'
          )}
          aria-label="Clear date"
          title="Clear date"
        >
          <X className={sm ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        </button>
      )}

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            {placement.sheet && (
              <div className="fixed inset-0 z-[999] bg-ink-950/40 tv-fade-in" onMouseDown={close} aria-hidden />
            )}
            {calendar}
          </>,
          document.body
        )}
    </div>
  );
}
