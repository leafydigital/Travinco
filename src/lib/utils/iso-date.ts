/** Local-time ISO date helpers (YYYY-MM-DD) for date pickers and range checks. */

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

/** `iso` shifted by whole years (defaults to today when `iso` is empty/invalid). */
export function addYearsIso(iso: string | null | undefined, years: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  const d = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date();
  d.setFullYear(d.getFullYear() + years);
  return toIsoDate(d);
}
