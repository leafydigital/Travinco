/** Password rules shared by the Users forms (same as the server checks). */
export const PASSWORD_RULES = [
  { key: 'length', label: 'At least 7 characters', test: (v: string) => v.length >= 7 },
  { key: 'upper', label: 'One capital letter', test: (v: string) => /[A-Z]/.test(v) },
  { key: 'lower', label: 'One lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { key: 'number', label: 'One number', test: (v: string) => /[0-9]/.test(v) },
  { key: 'symbol', label: 'One symbol', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

export const passwordMeetsRules = (v: string) => PASSWORD_RULES.every((r) => r.test(v));

/** Easy-to-read temporary password that meets every rule, e.g. "Tv7#kq3Pm9". */
export function generateTempPassword(length = 10): string {
  // No look-alike characters (0/O, 1/l/I)
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '@#$%&*!?';
  const all = upper + lower + digits + symbols;
  const pick = (set: string) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return set[buf[0]! % set.length]!;
  };
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < length) chars.push(pick(all));
  // Shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0]! % (i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}
