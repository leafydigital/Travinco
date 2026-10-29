'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type ComboInputProps = {
  id?: string;
  /** Submitted with the form when set (the typed / chosen text). */
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Text shown when the typed value matches no option. */
  emptyText?: string;
};

/**
 * Text input with a dropdown of suggestions: type anything, or pick from the list.
 * Typing filters the list; the chevron shows every option.
 */
export function ComboInput({
  id,
  name,
  value,
  onChange,
  options,
  placeholder,
  required,
  disabled,
  className,
  emptyText = 'No matches – the typed value will be used',
}: ComboInputProps) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  const q = value.trim().toLowerCase();
  const filtered = showAll || !q ? options : options.filter((o) => o.toLowerCase().includes(q));

  // Fixed positioning keeps the list visible inside scrolling modal bodies.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = inputRef.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom - 8;
      const above = r.top - 8;
      const flip = below < 160 && above > below;
      const maxHeight = Math.min(240, flip ? above : below);
      setPos({ top: flip ? r.top - maxHeight - 4 : r.bottom + 4, left: r.left, width: r.width, maxHeight });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t) && !listRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (active >= 0) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const pick = (o: string) => {
    onChange(o);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setShowAll(true);
        return;
      }
      const n = filtered.length;
      if (!n) return;
      setActive((a) => (e.key === 'ArrowDown' ? (a + 1) % n : (a - 1 + n) % n));
    } else if (e.key === 'Enter' && open && active >= 0 && filtered[active]) {
      e.preventDefault();
      pick(filtered[active]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        name={name}
        value={value}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        className={cn('input w-full pr-8', className)}
        onChange={(e) => {
          onChange(e.target.value);
          setShowAll(false);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => {
          setShowAll(true);
          setOpen(true);
        }}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label="Show options"
        className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-ink-400 hover:text-ink-700 disabled:opacity-50"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          setShowAll(true);
          setOpen((o) => !o);
          inputRef.current?.focus();
        }}
      >
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && pos && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
          className="z-[10050] overflow-y-auto rounded-lg border border-ink-200 bg-white py-1 text-sm shadow-lg shadow-ink-900/5"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-ink-400">{emptyText}</li>
          ) : (
            filtered.map((o, i) => (
              <li
                key={o}
                role="option"
                aria-selected={o === value}
                className={cn(
                  'cursor-pointer px-3 py-1.5 text-ink-700',
                  i === active ? 'bg-brand-50 text-brand-800' : 'hover:bg-ink-50',
                  o === value && 'font-medium text-brand-700'
                )}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}
              >
                {o}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
