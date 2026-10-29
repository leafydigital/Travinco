'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Date picker that always displays DD/MM/YYYY (the native <input type="date">
 * follows the device locale, e.g. MM/DD/YYYY on US devices, and can't be forced).
 *
 * Value in/out is ISO `YYYY-MM-DD` (same as the native input), so form
 * submission and server validation are unchanged. Dates outside [min, max]
 * are disabled and can't be picked; there is no free-text entry.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function toIso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseIso(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

export function formatIsoAsDMY(iso: string): string {
  const p = parseIso(iso);
  if (!p) return '';
  return `${String(p.d).padStart(2, '0')}/${String(p.m + 1).padStart(2, '0')}/${p.y}`;
}

export function DatePickerDMY({
  name,
  value,
  onChange,
  onClose,
  min,
  max,
  invalid = false,
  placeholder = 'DD/MM/YYYY',
  className = '',
}: {
  name?: string;
  /** ISO YYYY-MM-DD or '' */
  value: string;
  onChange: (iso: string) => void;
  /** Called when the calendar closes (acts like blur for validation). */
  onClose?: () => void;
  /** ISO YYYY-MM-DD, inclusive */
  min: string;
  /** ISO YYYY-MM-DD, inclusive */
  max: string;
  invalid?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const minP = parseIso(min)!;
  const maxP = parseIso(max)!;
  const selected = parseIso(value);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const base = selected ?? minP;
    return { y: base.y, m: base.m };
  });
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Re-centre the calendar on the selected date (or min) each time it opens
  useEffect(() => {
    if (!open) return;
    const base = parseIso(value) ?? parseIso(min)!;
    setView({ y: base.y, m: base.m });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setOpen(false);
    onClose?.();
  }

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
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

  // Monday-first grid
  const firstWeekday = (new Date(view.y, view.m, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function setMonth(y: number, m: number) {
    const idx = Math.min(Math.max(monthIndex(y, m), minMonth), maxMonth);
    setView({ y: Math.floor(idx / 12), m: idx % 12 });
  }

  return (
    <div ref={wrapperRef} className="relative">
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        className={`input flex w-full items-center justify-between bg-white text-left ${
          invalid ? 'border-coral-400 focus:ring-coral-400 bg-coral-50/20' : ''
        } ${className}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid}
      >
        <span className={value ? 'text-ink-900' : 'text-ink-400'}>
          {value ? formatIsoAsDMY(value) : placeholder}
        </span>
        <Calendar className="h-4 w-4 text-ink-400" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose travel date"
          className="absolute z-50 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-ink-200 bg-white p-3 shadow-lg"
        >
          {/* Month / year controls */}
          <div className="mb-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonth(view.y, view.m - 1)}
              disabled={viewMonth <= minMonth}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-600 hover:bg-ink-50 disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <select
              value={view.m}
              onChange={(e) => setMonth(view.y, Number(e.target.value))}
              className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-white py-1 pl-2 pr-7 text-sm bg-[length:1.1rem_1.1rem] bg-[right_0.3rem_center]"
              aria-label="Month"
            >
              {MONTHS.map((label, m) => {
                const idx = monthIndex(view.y, m);
                return (
                  <option key={label} value={m} disabled={idx < minMonth || idx > maxMonth}>
                    {MONTHS_SHORT[m]}
                  </option>
                );
              })}
            </select>
            <select
              value={view.y}
              onChange={(e) => setMonth(Number(e.target.value), view.m)}
              className="w-[5.25rem] shrink-0 rounded-lg border border-ink-200 bg-white py-1 pl-2 pr-7 text-sm bg-[length:1.1rem_1.1rem] bg-[right_0.3rem_center]"
              aria-label="Year"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setMonth(view.y, view.m + 1)}
              disabled={viewMonth >= maxMonth}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-600 hover:bg-ink-50 disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 text-center text-[11px] font-medium text-ink-400">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-0.5 text-center text-sm">
            {cells.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} />;
              const iso = toIso(view.y, view.m, day);
              const disabled = iso < min || iso > max;
              const isSelected = iso === value;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    // onChange validates the new value itself; onClose is only for
                    // dismissing without a pick (it would see the previous value here).
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={`h-8 rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-brand-600 font-semibold text-white'
                      : disabled
                        ? 'cursor-not-allowed text-ink-300 line-through decoration-ink-200'
                        : 'text-ink-700 hover:bg-brand-50 hover:text-brand-800'
                  }`}
                  aria-label={formatIsoAsDMY(iso)}
                  aria-pressed={isSelected}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
