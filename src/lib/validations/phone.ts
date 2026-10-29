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

/**
 * True for obviously fake numbers: one digit repeated (9999999999, 1111111111…)
 * or a straight run like 1234567890 / 9876543210. Works on the national digits.
 */
export function isRepeatedOrSequentialDigits(digits: string): boolean {
  const d = digits.replace(/\D/g, '');
  if (d.length < 6) return false;
  if (/^(\d)\1+$/.test(d)) return true;
  const asc = '01234567890123456789';
  const desc = '98765432109876543210';
  return asc.includes(d) || desc.includes(d);
}

/** Server-side check for a full phone value (with or without +dial code). */
export function isFakePhone(value: string | null | undefined): boolean {
  const raw = (value ?? '').trim();
  if (!raw) return false;
  const national = raw.startsWith('+')
    ? parsePhoneNumberFromString(raw)?.nationalNumber ?? raw.replace(/^\+\d{1,3}/, '')
    : raw;
  return isRepeatedOrSequentialDigits(national);
}

export const FAKE_PHONE_MESSAGE = 'Please enter a valid phone number.';
