import { parsePhoneNumberFromString } from 'libphonenumber-js';

/** True when the national part of the number is only zeros (e.g. "0000000000", "+91 00000 00000", "+910000000000"). */
export function isAllZeroPhone(value: string | null | undefined): boolean {
  const raw = (value ?? '').trim();
  if (!raw) return false;
  const national = raw.startsWith('+')
    ? parsePhoneNumberFromString(raw)?.nationalNumber ?? raw.replace(/^\+\d{1,3}/, '')
    : raw;
  const digits = national.replace(/\D/g, '');
  return digits.length > 0 && /^0+$/.test(digits);
}

export const ALL_ZERO_PHONE_MESSAGE = 'Phone number cannot be all zeros.';
