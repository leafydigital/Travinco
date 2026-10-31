'use client';

import { useEffect, useRef, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const TEXT_TYPES = new Set(['text', 'search', 'email', 'tel', 'number']);

/**
 * Filter row for list pages. Children are plain named inputs/selects; there is no
 * Filter button: changing a dropdown or date applies straight away, typing in a
 * text box applies after a short pause (Enter works too). The URL is updated with
 * router.replace, so the page's Suspense key re-streams the table without a full reload.
 * Ends with a Refresh button that re-fetches the current table.
 */
export function FilterBar({
  children,
  className,
  debounceMs = 400,
}: {
  children: React.ReactNode;
  /** Extra classes for the row, e.g. a max width. */
  className?: string;
  debounceMs?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [filtering, startFilter] = useTransition();
  const [refreshing, startRefresh] = useTransition();

  useEffect(() => () => clearTimeout(timer.current), []);

  function apply() {
    const form = formRef.current;
    if (!form) return;
    const params = new URLSearchParams(current.toString());
    const data = new FormData(form);
    // Every named control owns its param: clear them all, then set the ones with a value
    new Set(Array.from(form.elements).map((el) => (el as HTMLInputElement).name).filter(Boolean)).forEach((n) => params.delete(n));
    data.forEach((v, k) => {
      const value = String(v).trim();
      if (value) params.append(k, value);
    });
    params.delete('page'); // a new filter starts from page 1
    const qs = params.toString();
    startFilter(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <form
      ref={formRef}
      method="get"
      className={cn(
        // Flows left to right and wraps instead of overflowing; on phones every control is full width
        'flex flex-wrap items-center gap-3 max-sm:[&>*:not([type=hidden])]:w-full',
        className
      )}
      onSubmit={(e) => {
        e.preventDefault();
        clearTimeout(timer.current);
        apply();
      }}
      onChange={(e) => {
        const t = e.target as HTMLInputElement;
        if (t.tagName === 'INPUT' && TEXT_TYPES.has(t.type)) {
          clearTimeout(timer.current);
          timer.current = setTimeout(apply, debounceMs);
        } else {
          apply();
        }
      }}
    >
      {children}
      <button
        type="button"
        onClick={() => startRefresh(() => router.refresh())}
        disabled={refreshing}
        className="btn-outline ml-auto shrink-0 justify-center"
        title="Reload the table"
        aria-busy={refreshing || filtering}
      >
        <RefreshCw className={cn('h-4 w-4', (refreshing || filtering) && 'animate-spin')} />
        <span>Refresh</span>
      </button>
    </form>
  );
}
