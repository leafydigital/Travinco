'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Plus, Star, X, Package as PackageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { DatePickerDMY } from '@/components/public/date-picker-dmy';
import { CURRENCY_OPTIONS } from '@/lib/currencies';

/* ------------------------------------------------------------------ */
/* Number inputs                                                       */
/* ------------------------------------------------------------------ */

/** onKeyDown for number inputs that must never go negative / use exponents. */
export function blockNonNumericKeys(e: React.KeyboardEvent<HTMLInputElement>, allowDecimal = true) {
  if (['-', '+', 'e', 'E'].includes(e.key) || (!allowDecimal && e.key === '.')) {
    e.preventDefault();
  }
}

/**
 * Parses a number input's value: '' stays '' (so the field can be cleared),
 * negatives are rejected (returns null so the caller can ignore the change).
 */
export function parseNonNegative(raw: string, integer = false): number | '' | null {
  if (raw === '') return '';
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return integer ? Math.floor(n) : n;
}

/* ------------------------------------------------------------------ */
/* Generic combobox                                                    */
/* ------------------------------------------------------------------ */

type ComboOption = { value: string; label: string; hint?: string };

function Combobox({
  text,
  onTextChange,
  options,
  onSelect,
  placeholder,
  invalid,
  createLabel,
  inputClassName,
  maxResults = 60,
}: {
  text: string;
  onTextChange: (text: string) => void;
  options: ComboOption[];
  onSelect: (option: ComboOption) => void;
  placeholder?: string;
  invalid?: boolean;
  /** When set, shows a "create" row for text that matches no option. */
  createLabel?: (text: string) => string;
  inputClassName?: string;
  maxResults?: number;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [filterText, setFilterText] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // Filter by what the user typed since opening; on open show the full list.
  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const list = q
      ? options.filter(
          (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q)
        )
      : options;
    return list.slice(0, maxResults);
  }, [options, filterText, maxResults]);

  const trimmed = text.trim();
  const exactMatch = options.some(
    (o) => o.label.toLowerCase() === trimmed.toLowerCase() || o.value.toLowerCase() === trimmed.toLowerCase()
  );
  const showCreate = Boolean(createLabel && trimmed && !exactMatch && filterText);
  const rowCount = filtered.length + (showCreate ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function choose(index: number) {
    const option = filtered[index];
    if (option) onSelect(option);
    // The "create" row keeps the typed text as-is.
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={text}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-invalid={invalid}
          onFocus={() => {
            setFilterText('');
            setActive(0);
            setOpen(true);
          }}
          onChange={(e) => {
            onTextChange(e.target.value);
            setFilterText(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, Math.max(rowCount - 1, 0)));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter') {
              if (open && rowCount > 0) {
                e.preventDefault();
                choose(active);
              }
            } else if (e.key === 'Escape' || e.key === 'Tab') {
              setOpen(false);
            }
          }}
          className={cn(
            'input pr-8',
            invalid && 'border-red-400 focus:border-red-500 focus:ring-red-500',
            inputClassName
          )}
        />
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      </div>

      {open && rowCount > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full min-w-[14rem] overflow-y-auto rounded-xl border border-ink-200 bg-white py-1 text-sm shadow-lg"
        >
          {filtered.map((o, i) => (
            <li key={o.value}>
              <button
                type="button"
                data-no-confirm-save="true"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left',
                  i === active ? 'bg-brand-50 text-brand-800' : 'text-ink-700'
                )}
              >
                <span className="truncate">{o.label}</span>
                {o.hint && <span className="shrink-0 text-xs text-ink-400">{o.hint}</span>}
              </button>
            </li>
          ))}
          {showCreate && (
            <li>
              <button
                type="button"
                data-no-confirm-save="true"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(filtered.length)}
                onClick={() => choose(filtered.length)}
                className={cn(
                  'flex w-full items-center gap-2 border-t border-ink-100 px-3 py-2 text-left text-brand-700',
                  active === filtered.length && 'bg-brand-50'
                )}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="truncate">{createLabel!(trimmed)}</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Destination                                                         */
/* ------------------------------------------------------------------ */

export type DestinationValue = { id: string | null; name: string };

/** Resolves typed text to an existing destination (case-insensitive) or a new name. */
export function resolveDestinationText(
  destinations: { id: string; name: string }[],
  text: string
): DestinationValue {
  const match = destinations.find((d) => d.name.trim().toLowerCase() === text.trim().toLowerCase());
  return match ? { id: match.id, name: match.name } : { id: null, name: text };
}

/**
 * Destination picker: choose from existing destinations or type a new one.
 * A new name is created as a destination when the package is saved.
 */
export function DestinationCombobox({
  destinations,
  value,
  onChange,
  invalid,
  inputClassName,
}: {
  destinations: { id: string; name: string }[];
  value: DestinationValue;
  onChange: (value: DestinationValue) => void;
  invalid?: boolean;
  inputClassName?: string;
}) {
  const options = useMemo(
    () => destinations.map((d) => ({ value: d.id, label: d.name })),
    [destinations]
  );
  const isNew = !value.id && value.name.trim().length > 0;

  return (
    <div>
      <Combobox
        text={value.name}
        onTextChange={(text) => onChange(resolveDestinationText(destinations, text))}
        options={options}
        onSelect={(o) => onChange({ id: o.value, name: o.label })}
        placeholder="Type or select a destination"
        invalid={invalid}
        createLabel={(t) => `Add “${t}” as a new destination`}
        inputClassName={inputClassName}
      />
      {isNew && (
        <p className="mt-1 text-xs text-brand-700">
          New destination “{value.name.trim()}” will be created on save.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Currency                                                            */
/* ------------------------------------------------------------------ */

const currencyOptions: ComboOption[] = CURRENCY_OPTIONS.map((c) => ({
  value: c.code,
  label: `${c.code} — ${c.name}`,
}));
const knownCodes = new Set(CURRENCY_OPTIONS.map((c) => c.code));

/** Any world currency from the list, or a custom 3-letter code. */
export function CurrencyCombobox({
  value,
  onChange,
  invalid,
  inputClassName,
}: {
  value: string;
  onChange: (code: string) => void;
  invalid?: boolean;
  inputClassName?: string;
}) {
  const custom = value.length === 3 && !knownCodes.has(value);
  return (
    <div>
      <Combobox
        text={value}
        onTextChange={(text) => onChange(text.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))}
        options={currencyOptions}
        onSelect={(o) => onChange(o.value)}
        placeholder="e.g. INR"
        invalid={invalid}
        createLabel={(t) => (t.length === 3 ? `Use custom currency “${t}”` : 'Custom codes need 3 letters')}
        inputClassName={inputClassName}
        maxResults={200}
      />
      {custom && <p className="mt-1 text-xs text-ink-500">Custom currency code</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Availability window: from today up to 2 years ahead (local time). */
export function availabilityRange() {
  const today = new Date();
  const max = new Date(today);
  max.setFullYear(max.getFullYear() + 2);
  return { min: isoDate(today), max: isoDate(max) };
}

/** DD/MM/YYYY calendar (same picker as the public "Book with us" form), clearable. */
export function AdminDateField({
  value,
  onChange,
  min,
  max,
  invalid,
}: {
  value: string;
  onChange: (iso: string) => void;
  min: string;
  max: string;
  invalid?: boolean;
}) {
  // Keep an existing (older) saved date visible/selectable when editing.
  const effectiveMin = value && value < min ? value : min;
  return (
    <div className="relative">
      <DatePickerDMY value={value} onChange={onChange} min={effectiveMin} max={max} invalid={invalid} />
      {value && (
        <button
          type="button"
          data-no-confirm-save="true"
          onClick={() => onChange('')}
          className="absolute right-8 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          aria-label="Clear date"
          title="Clear date"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Featured limit modal                                                */
/* ------------------------------------------------------------------ */

export type FeaturedItem = {
  id: string;
  title: string;
  cover_image_url?: string | null;
  /** 'draft' = a package in the current bulk batch, not yet saved. */
  kind?: 'existing' | 'draft';
};

export function FeaturedLimitModal({
  isOpen,
  items,
  max,
  onRemove,
  onClose,
}: {
  isOpen: boolean;
  items: FeaturedItem[];
  max: number;
  onRemove: (item: FeaturedItem) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-ink-950/50 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Featured packages limit"
        className="w-full max-w-lg rounded-2xl border border-ink-100 bg-white p-5 shadow-lg shadow-ink-900/5 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-ink-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Star className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink-900">Featured limit reached</h2>
              <p className="text-xs text-ink-500">
                Only {max} packages can be featured on the homepage. Remove one to feature this package.
              </p>
            </div>
          </div>
          <button
            type="button"
            data-no-confirm-save="true"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
  
        <ul className="mt-3 divide-y divide-ink-100">
          {items.map((item) => (
            <li key={`${item.kind ?? 'existing'}-${item.id}`} className="flex items-center gap-3 py-2.5">
              <div className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-ink-200 bg-ink-100">
                {item.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.cover_image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <PackageIcon className="h-4 w-4 text-ink-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-800">{item.title || 'Untitled package'}</p>
                {item.kind === 'draft' && <p className="text-[11px] text-ink-400">In this batch (not saved yet)</p>}
              </div>
              <button
                type="button"
                data-no-confirm-save="true"
                onClick={() => onRemove(item)}
                className="btn-outline h-8 px-3 text-xs text-coral-700"
              >
                Un-feature
              </button>
            </li>
          ))}
        </ul>
  
        <p className="mt-3 text-[11px] text-ink-400">
          The removed package stops being featured when you save this package.
        </p>
      </div>
    </div>,
    document.body
  );
}

/** Small inline loader used while the featured list is fetched. */
export function FeaturedCheckingHint() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-400">
      <Loader2 className="h-3 w-3 animate-spin" /> Checking featured packages…
    </span>
  );
}
