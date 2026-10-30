import { COUNTRY_PHONE_CODES } from '@/components/public/phone-input';

export type PhoneParts = { dialCode: string; number: string; country?: string };

/** Splits a stored "+<dial code><number>" phone into the PhoneInput value shape. */
export function splitPhone(stored?: string | null): PhoneParts {
  if (!stored) return { dialCode: '+91', number: '' };
  if (!stored.startsWith('+')) return { dialCode: '+91', number: stored.replace(/\D/g, '') };
  const sorted = [...COUNTRY_PHONE_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const c of sorted) {
    if (stored.startsWith(c.code)) return { dialCode: c.code, number: stored.slice(c.code.length).replace(/\D/g, '') };
  }
  return { dialCode: '+91', number: stored.replace(/\D/g, '') };
}

export const joinPhone = (p: PhoneParts) => (p.number ? `${p.dialCode}${p.number}` : '');
