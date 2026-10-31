/** Shared text rules for names and titles across the admin and public forms. */

/** True when the text has something in it but no letters at all (e.g. "12345", "5/4", "---"). */
export function isNumbersOnlyText(text: string | null | undefined): boolean {
  const t = (text ?? '').trim();
  return t.length > 0 && !/\p{L}/u.test(t);
}

/** "<Label> must contain letters, not only numbers" */
export function lettersRequiredMessage(label: string): string {
  return `${label} must contain letters, not only numbers`;
}
