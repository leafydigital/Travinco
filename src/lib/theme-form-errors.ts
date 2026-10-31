'use client';

import { toast } from '@/lib/admin-alert';
import type { ThemeErrors } from '@/lib/validations/theme';

const INVALID_ATTR = 'data-theme-invalid';

/** Removes highlights left over from a previous failed save. */
function clearHighlights() {
  document.querySelectorAll<HTMLElement>(`[${INVALID_ATTR}]`).forEach((el) => {
    el.removeAttribute(INVALID_ATTR);
    el.removeAttribute('aria-invalid');
    el.style.borderColor = '';
    el.style.boxShadow = '';
  });
}

/**
 * Shows theme validation errors: a toast with the first problem, a red outline
 * on every field tagged `data-field="<path>"` that has an error, and a scroll to
 * the first one. Returns true when there were errors (the save must stop).
 */
export function reportThemeErrors(errors: ThemeErrors): boolean {
  clearHighlights();
  const entries = Object.entries(errors);
  if (entries.length === 0) return false;

  const [, first] = entries[0]!;
  toast.error(first, {
    description:
      entries.length > 1
        ? `${entries.length - 1} more field${entries.length > 2 ? 's need' : ' needs'} fixing. Nothing was saved.`
        : 'Nothing was saved.',
  });

  let firstEl: HTMLElement | null = null;
  for (const [path] of entries) {
    const el = document.querySelector<HTMLElement>(`[data-field="${CSS.escape(path)}"]`);
    if (!el) continue;
    el.setAttribute(INVALID_ATTR, 'true');
    el.setAttribute('aria-invalid', 'true');
    el.style.borderColor = '#f87171';
    el.style.boxShadow = '0 0 0 1px #f87171';
    el.addEventListener(
      'input',
      () => {
        el.removeAttribute(INVALID_ATTR);
        el.removeAttribute('aria-invalid');
        el.style.borderColor = '';
        el.style.boxShadow = '';
      },
      { once: true }
    );
    firstEl ??= el;
  }
  firstEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  firstEl?.focus({ preventScroll: true });
  return true;
}
