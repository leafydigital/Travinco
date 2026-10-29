'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
  type CountryCode,
} from 'libphonenumber-js/mobile';
import { isRepeatedOrSequentialDigits } from '@/lib/validations/phone';
import { COUNTRY_NAMES } from '@/lib/country-names';

/**
 * Every country from libphonenumber-js (Google's libphonenumber metadata),
 * sorted by dial code in numeric order (+1, +7, +20 … +998), then by name.
 *
 * Validation uses the "mobile" metadata: a number must be a real mobile
 * number pattern for the selected country (correct length AND prefixes),
 * not just the right number of digits.
 */

/** Locale-independent name order (same on server and browser; accents ignored). */
function compareNames(a: string, b: string) {
  const plain = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const x = plain(a);
  const y = plain(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

export type CountryPhoneCode = { iso: CountryCode; code: string; country: string };

export const COUNTRY_PHONE_CODES: CountryPhoneCode[] = getCountries()
  .map((iso) => ({
    iso,
    code: `+${getCountryCallingCode(iso)}`,
    // Static names: Intl.DisplayNames differs between Node and browsers (hydration mismatch)
    country: COUNTRY_NAMES[iso] ?? iso,
  }))
  .sort(
    (a, b) =>
      Number(a.code.slice(1)) - Number(b.code.slice(1)) || compareNames(a.country, b.country)
  );

const DEFAULT_COUNTRY: CountryCode = 'IN';

/** Main country for dial codes shared by several countries/territories. */
const MAIN_COUNTRY_FOR_DIAL_CODE: Record<string, CountryCode> = {
  '+1': 'US', '+7': 'RU', '+44': 'GB', '+47': 'NO', '+61': 'AU', '+212': 'MA',
  '+262': 'RE', '+290': 'SH', '+358': 'FI', '+590': 'GP', '+599': 'CW', '+91': 'IN',
};

/** Main country for a dial code (e.g. +1 -> US, +44 -> GB, +7 -> RU). */
function mainCountryForDialCode(dialCode: string): CountryCode {
  return (
    MAIN_COUNTRY_FOR_DIAL_CODE[dialCode] ??
    COUNTRY_PHONE_CODES.find((c) => c.code === dialCode)?.iso ??
    DEFAULT_COUNTRY
  );
}

/** Picks the most specific country for a dial code + national number. */
function resolveCountry(dialCode: string, number: string, current?: CountryCode): CountryCode {
  if (current && `+${getCountryCallingCode(current)}` === dialCode) return current;
  const digits = number.replace(/\D/g, '');
  if (digits) {
    const detected = parsePhoneNumberFromString(`${dialCode}${digits}`)?.country;
    if (detected) return detected;
  }
  return mainCountryForDialCode(dialCode);
}

export function PhoneInput({
  name,
  required,
  placeholder,
  defaultDialCode = '+91',
  onValidityChange,
  value: controlledValue,
  onChange: controlledOnChange,
  disabled,
  compact,
}: {
  name: string;
  disabled?: boolean;
  /** Narrow country picker that shows only the dial code (e.g. "+91"), leaving more room for the number. */
  compact?: boolean;
  required?: boolean;
  placeholder?: string;
  defaultDialCode?: string;
  onValidityChange?: (isValid: boolean) => void;
  /** Optional controlled mode — used by the "same as phone number" sync. */
  value?: { dialCode: string; number: string; country?: string };
  onChange?: (value: { dialCode: string; number: string; country?: string }) => void;
}) {
  const [internalDialCode, setInternalDialCode] = useState(defaultDialCode);
  const [internalNumber, setInternalNumber] = useState('');
  const [touched, setTouched] = useState(false);

  const isControlled = controlledValue !== undefined;
  const dialCode = isControlled ? controlledValue.dialCode : internalDialCode;
  const number = isControlled ? controlledValue.number : internalNumber;

  // Several countries share a dial code (+1, +7, +44…), so the chosen country is
  // tracked separately; the submitted/controlled value stays dial code + number.
  const [countryIso, setCountryIso] = useState<CountryCode>(() =>
    resolveCountry(dialCode, number, (controlledValue?.country as CountryCode) || undefined)
  );

  // Keep the selected country consistent when the dial code changes from outside
  // (e.g. "WhatsApp same as phone" copies the phone value, or admin edit forms load).
  useEffect(() => {
    const external = controlledValue?.country as CountryCode | undefined;
    if (external && external !== countryIso && `+${getCountryCallingCode(external)}` === dialCode) {
      setCountryIso(external);
      return;
    }
    if (`+${getCountryCallingCode(countryIso)}` !== dialCode) {
      setCountryIso(resolveCountry(dialCode, number));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialCode, controlledValue?.country]);

  function emit(next: { dialCode: string; number: string; country: CountryCode }) {
    if (isControlled) controlledOnChange?.(next);
    else {
      setInternalDialCode(next.dialCode);
      setInternalNumber(next.number);
    }
  }

  function setCountry(iso: CountryCode) {
    setCountryIso(iso);
    emit({ dialCode: `+${getCountryCallingCode(iso)}`, number, country: iso });
  }
  function setNumber(next: string) {
    emit({ dialCode, number: next, country: countryIso });
  }

  const digitsOnly = number.replace(/\D/g, '');
  const countryName = COUNTRY_PHONE_CODES.find((c) => c.iso === countryIso)?.country ?? countryIso;

  const { isValid, errorMessage } = useMemo(() => {
    if (!digitsOnly) return { isValid: false, errorMessage: null as string | null };
    if (/^0+$/.test(digitsOnly)) return { isValid: false, errorMessage: 'Enter a valid mobile number' };
    if (isRepeatedOrSequentialDigits(digitsOnly.replace(/^0+/, '') || digitsOnly)) {
      return { isValid: false, errorMessage: 'Enter a valid mobile number' };
    }

    if (isValidPhoneNumber(digitsOnly, countryIso)) return { isValid: true, errorMessage: null };

    const lengthIssue = validatePhoneNumberLength(digitsOnly, countryIso);
    if (lengthIssue === 'TOO_SHORT') {
      return { isValid: false, errorMessage: `This number is too short for ${countryName}.` };
    }
    if (lengthIssue === 'TOO_LONG') {
      return { isValid: false, errorMessage: `This number is too long for ${countryName}.` };
    }
    return {
      isValid: false,
      errorMessage: `Enter a valid ${countryName} mobile number.`,
    };
  }, [digitsOnly, countryIso, countryName]);

  const showError = touched && number.length > 0 && !isValid;

  // Valid numbers are submitted in normalised E.164 (e.g. a typed trunk "0" is dropped:
  // 09876543210 -> +919876543210); anything else as typed, for the server to reject.
  const submittedValue = !digitsOnly
    ? ''
    : isValid
      ? parsePhoneNumberFromString(digitsOnly, countryIso)?.number ?? `${dialCode}${digitsOnly}`
      : `${dialCode}${digitsOnly}`;

  useEffect(() => {
    const valid = number.length === 0 ? !required : isValid;
    onValidityChange?.(valid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [number, countryIso, required, isValid]);

  return (
    <div>
      <div className="flex gap-2">
        <div className={`relative shrink-0 ${compact ? 'w-[4.75rem]' : 'w-28'}`}>
          <select
            value={countryIso}
            onChange={(e) => {
              setCountry(e.target.value as CountryCode);
              setTouched(false);
            }}
            disabled={disabled}
            title={countryName}
            className={`input w-full text-base disabled:cursor-not-allowed disabled:bg-ink-50 disabled:opacity-100 ${
              compact
                ? // Only the overlay below shows the code — the select's own "+91 India" stays hidden, even when disabled
                  'pl-2 pr-6 text-transparent disabled:text-transparent [-webkit-text-fill-color:transparent] bg-[position:right_0.3rem_center]'
                : 'disabled:text-ink-700'
            } ${showError ? 'border-coral-400 focus:ring-coral-400' : ''}`}
            aria-label="Country code"
          >
            {COUNTRY_PHONE_CODES.map((c) => (
              <option key={c.iso} value={c.iso} className="text-ink-900 [-webkit-text-fill-color:theme(colors.ink.900)]">
                {c.code} {c.country}
              </option>
            ))}
          </select>
          {/* Compact mode: the closed picker shows only the dial code; the list keeps country names */}
          {compact && (
            <span
              className={`pointer-events-none absolute inset-y-0 left-2 flex items-center text-sm ${
                disabled ? 'text-ink-700' : 'text-ink-900'
              }`}
            >
              {dialCode}
            </span>
          )}
        </div>
        <input
          type="tel"
          inputMode="numeric"
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          value={number}
          onChange={(e) => setNumber(e.target.value.replace(/[^\d]/g, ''))}
          onBlur={() => {
            setTouched(true);
            // Normalise a valid number to its national significant number (drops a typed
            // trunk "0", e.g. 09876543210 -> 9876543210), since the forms save dialCode + number.
            if (isValid) {
              const national = parsePhoneNumberFromString(digitsOnly, countryIso)?.nationalNumber;
              if (national && national !== number) setNumber(national);
            }
          }}
          // Larger, bolder text specifically for phone numbers — these
          // get mistyped easily, so legibility matters more here than
          // on most fields.
          className={`input flex-1 text-base font-medium tracking-wide disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-700 disabled:opacity-100 disabled:[-webkit-text-fill-color:theme(colors.ink.700)] ${showError ? 'border-coral-400 focus:ring-coral-400' : ''}`}
        />
      </div>
      {showError && errorMessage && (
        <p className="mt-1 text-xs text-coral-600 font-medium">{errorMessage}</p>
      )}
      {/* The actual field submitted with the form: full E.164-style
          string (dial code + digits), so the server sees one clean
          value regardless of how the picker/input are split visually. */}
      <input type="hidden" name={name} value={submittedValue} />
    </div>
  );
}
