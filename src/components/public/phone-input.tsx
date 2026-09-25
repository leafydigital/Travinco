'use client';

import { useState, useEffect } from 'react';

/**
 * Country dial codes with their expected national-number length (digits
 * only, not counting the dial code itself) — this list intentionally
 * covers common/major countries rather than every ITU entry, since an
 * exhaustive list would need constant upkeep for little practical gain
 * on a travel-enquiry form.
 */
export const COUNTRY_PHONE_CODES = [
  { code: '+91', country: 'India', digits: 10 },
  { code: '+1', country: 'USA/Canada', digits: 10 },
  { code: '+44', country: 'United Kingdom', digits: 10 },
  { code: '+61', country: 'Australia', digits: 9 },
  { code: '+971', country: 'UAE', digits: 9 },
  { code: '+966', country: 'Saudi Arabia', digits: 9 },
  { code: '+65', country: 'Singapore', digits: 8 },
  { code: '+60', country: 'Malaysia', digits: 9 },
  { code: '+94', country: 'Sri Lanka', digits: 9 },
  { code: '+977', country: 'Nepal', digits: 10 },
  { code: '+880', country: 'Bangladesh', digits: 10 },
  { code: '+92', country: 'Pakistan', digits: 10 },
  { code: '+64', country: 'New Zealand', digits: 9 },
  { code: '+49', country: 'Germany', digits: 10 },
  { code: '+33', country: 'France', digits: 9 },
  { code: '+39', country: 'Italy', digits: 10 },
  { code: '+34', country: 'Spain', digits: 9 },
  { code: '+31', country: 'Netherlands', digits: 9 },
  { code: '+41', country: 'Switzerland', digits: 9 },
  { code: '+81', country: 'Japan', digits: 10 },
  { code: '+82', country: 'South Korea', digits: 10 },
  { code: '+86', country: 'China', digits: 11 },
  { code: '+27', country: 'South Africa', digits: 9 },
  { code: '+55', country: 'Brazil', digits: 11 },
  { code: '+52', country: 'Mexico', digits: 10 },
  { code: '+7', country: 'Russia', digits: 10 },
] as const;

export function PhoneInput({
  name,
  required,
  placeholder,
  defaultDialCode = '+91',
  onValidityChange,
  value: controlledValue,
  onChange: controlledOnChange,
}: {
  name: string;
  required?: boolean;
  placeholder?: string;
  defaultDialCode?: string;
  onValidityChange?: (isValid: boolean) => void;
  /** Optional controlled mode — used by the "same as phone number" sync. */
  value?: { dialCode: string; number: string };
  onChange?: (value: { dialCode: string; number: string }) => void;
}) {
  const [internalDialCode, setInternalDialCode] = useState(defaultDialCode);
  const [internalNumber, setInternalNumber] = useState('');
  const [touched, setTouched] = useState(false);

  const isControlled = controlledValue !== undefined;
  const dialCode = isControlled ? controlledValue.dialCode : internalDialCode;
  const number = isControlled ? controlledValue.number : internalNumber;

  function setDialCode(next: string) {
    if (isControlled) controlledOnChange?.({ dialCode: next, number });
    else setInternalDialCode(next);
  }
  function setNumber(next: string) {
    if (isControlled) controlledOnChange?.({ dialCode, number: next });
    else setInternalNumber(next);
  }

  const country = COUNTRY_PHONE_CODES.find((c) => c.code === dialCode) ?? COUNTRY_PHONE_CODES[0];
  const digitsOnly = number.replace(/\D/g, '');
  const isValidLength = digitsOnly.length === country.digits;
  const showError = touched && number.length > 0 && !isValidLength;

  useEffect(() => {
    const valid = number.length === 0 ? !required : isValidLength;
    onValidityChange?.(valid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [number, dialCode, required]);

  return (
    <div>
      <div className="flex gap-2">
        <select
          value={dialCode}
          onChange={(e) => {
            setDialCode(e.target.value);
            setTouched(false);
          }}
          className="input w-28 shrink-0 text-base"
          aria-label="Country code"
        >
          {COUNTRY_PHONE_CODES.map((c, i) => (
            <option key={`${c.code}-${i}`} value={c.code}>
              {c.code} {c.country}
            </option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="numeric"
          required={required}
          placeholder={placeholder}
          value={number}
          onChange={(e) => setNumber(e.target.value.replace(/[^\d]/g, ''))}
          onBlur={() => setTouched(true)}
          // Larger, bolder text specifically for phone numbers — these
          // get mistyped easily, so legibility matters more here than
          // on most fields.
          className="input flex-1 text-base font-medium tracking-wide"
        />
      </div>
      {showError && (
        <p className="mt-1 text-xs text-coral-600">
          {country.country} numbers need exactly {country.digits} digits — you entered{' '}
          {digitsOnly.length}.
        </p>
      )}
      {/* The actual field submitted with the form: full E.164-style
          string (dial code + digits), so the server sees one clean
          value regardless of how the picker/input are split visually. */}
      <input type="hidden" name={name} value={digitsOnly ? `${dialCode}${digitsOnly}` : ''} />
    </div>
  );
}
