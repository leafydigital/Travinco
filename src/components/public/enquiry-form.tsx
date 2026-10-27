'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { requestEnquiryOtp, verifyEnquiryOtpAndSubmit } from '@/app/(public)/actions';
import { PhoneInput } from './phone-input';
import {
  CheckCircle2,
  User,
  Compass,
  Calendar,
  Users,
  Package,
  ChevronDown,
  Search,
  X,
  Mail,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  RefreshCw,
} from 'lucide-react';

/** Returns today's date in YYYY-MM-DD format (local time). */
function getTodayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ─── Searchable Package Combobox ──────────────────────────────────────────────

const CUSTOM_TOUR_OPTION = { id: '', title: 'Custom Tour / Tailored Trip (No specific package)' };

function PackageCombobox({
  packages,
  defaultId = '',
  inputClassName = '',
  onValidityChange,
}: {
  packages: { id: string; title: string }[];
  defaultId?: string;
  inputClassName?: string;
  onValidityChange?: (valid: boolean) => void;
}) {
  const allOptions = useMemo(() => [CUSTOM_TOUR_OPTION, ...packages], [packages]);
  const initialPkg =
    packages.find((p) => p.id === defaultId) ?? (defaultId === '' ? CUSTOM_TOUR_OPTION : null);

  const [query, setQuery] = useState(initialPkg?.id ? initialPkg.title : '');
  const [selectedId, setSelectedId] = useState(defaultId);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [touched, setTouched] = useState(false);

  // Sync with defaultId prop if it changes externally
  useEffect(() => {
    if (defaultId) {
      const match = packages.find((p) => p.id === defaultId);
      if (match) {
        setSelectedId(defaultId);
        setQuery(match.title);
        onValidityChange?.(true);
      }
    }
  }, [defaultId, packages, onValidityChange]);

  const isValid = !!selectedId;
  const showError = touched && !isValid;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = query.trim()
    ? allOptions.filter((o) => o.title.toLowerCase().includes(query.trim().toLowerCase()))
    : allOptions;

  // Close when clicking outside.
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setTouched(true);
        const confirmed = allOptions.find((o) => o.id === selectedId);
        setQuery(confirmed?.id ? confirmed.title : '');
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [selectedId, allOptions]);

  // Scroll highlighted item into view.
  useEffect(() => {
    if (!isOpen) return;
    const el = listRef.current?.children[highlightedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen]);

  function selectOption(option: { id: string; title: string }) {
    setSelectedId(option.id);
    setQuery(option.id ? option.title : '');
    setIsOpen(false);
    setHighlightedIndex(0);
    setTouched(true);
    onValidityChange?.(!!option.id);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlightedIndex]) selectOption(filtered[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      const confirmed = allOptions.find((o) => o.id === selectedId);
      setQuery(confirmed?.id ? confirmed.title : '');
    }
  }

  const showClearButton = !!selectedId;

  return (
    <div ref={wrapperRef} className="relative">
      <input type="hidden" name="package_id" value={selectedId} />

      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          <Search className="h-3.5 w-3.5 text-ink-400" />
        </span>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          autoComplete="off"
          placeholder="Search or choose a package…"
          value={query}
          onFocus={() => {
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          className={`${inputClassName} pl-8 pr-16 ${showError ? 'border-coral-400 focus:ring-coral-400' : ''}`}
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="package-options-list"
          aria-haspopup="listbox"
          aria-label="Choose tour package"
          aria-required="true"
        />
        <span className="absolute inset-y-0 right-0 flex items-center gap-0.5 pr-2">
          {showClearButton && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                selectOption(CUSTOM_TOUR_OPTION);
                inputRef.current?.focus();
              }}
              className="flex h-5 w-5 items-center justify-center rounded-full text-ink-400 hover:text-ink-600 transition-colors"
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              setIsOpen((o) => !o);
              inputRef.current?.focus();
            }}
            className="flex h-5 w-5 items-center justify-center text-ink-400 hover:text-ink-600 transition-colors"
            aria-label="Toggle package list"
          >
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </span>
      </div>

      {isOpen && (
        <ul
          id="package-options-list"
          ref={listRef}
          role="listbox"
          aria-label="Package options"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-ink-200 bg-white py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-ink-400">No packages match your search.</li>
          ) : (
            filtered.map((option, idx) => {
              const isSelected = option.id === selectedId;
              const isHighlighted = idx === highlightedIndex;
              return (
                <li
                  key={option.id || '__custom__'}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectOption(option)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                    isHighlighted ? 'bg-brand-50 text-brand-800' : 'text-ink-700 hover:bg-ink-50'
                  } ${isSelected ? 'font-semibold' : ''}`}
                >
                  {option.id === '' ? (
                    <span className="text-ink-400 text-xs italic">{option.title}</span>
                  ) : (
                    <span>{option.title}</span>
                  )}
                  {isSelected && option.id !== '' && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-600" />
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
      {showError && (
        <p className="mt-1 text-xs text-coral-600">Please select a tour package to continue.</p>
      )}
    </div>
  );
}

// ─── 6-Digit OTP Input Subcomponent ───────────────────────────────────────────

function OtpInputBoxes({
  value,
  onChange,
  onComplete,
  disabled,
}: {
  value: string[];
  onChange: (digits: string[]) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Auto-focus first empty input on mount
    const firstEmpty = value.findIndex((v) => !v);
    const targetIdx = firstEmpty === -1 ? 0 : firstEmpty;
    inputsRef.current[targetIdx]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDigitChange(idx: number, e: React.ChangeEvent<HTMLInputElement>) {
    const rawVal = e.target.value;
    const digit = rawVal.replace(/\D/g, '').slice(-1);

    const next = [...value];
    next[idx] = digit;
    onChange(next);

    if (digit && idx < 5) {
      inputsRef.current[idx + 1]?.focus();
    }

    const fullCode = next.join('');
    if (fullCode.length === 6) {
      onComplete?.(fullCode);
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !value[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const next = [...value];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || '';
    }
    onChange(next);

    const focusIdx = Math.min(pasted.length, 5);
    inputsRef.current[focusIdx]?.focus();

    if (pasted.length === 6) {
      onComplete?.(pasted);
    }
  }

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          disabled={disabled}
          value={value[i] || ''}
          onChange={(e) => handleDigitChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="h-12 w-11 sm:h-14 sm:w-13 rounded-xl border border-ink-200 bg-white text-center text-xl sm:text-2xl font-bold text-brand-900 shadow-sm transition-all focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50"
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

// ─── Main EnquiryForm Component ───────────────────────────────────────────────

export function EnquiryForm({
  packageId,
  destinationName,
  buttonLabel = 'Send Quote',
  isLoggedIn = false,
  defaultName = '',
  defaultEmail = '',
  layout = 'stacked',
  availablePackages,
}: {
  packageId?: string;
  destinationName?: string;
  buttonLabel?: string;
  isLoggedIn?: boolean;
  defaultName?: string;
  defaultEmail?: string;
  layout?: 'stacked' | 'split';
  availablePackages?: { id: string; title: string }[];
}) {
  const pathname = usePathname();
  const prevPathnameRef = useRef(pathname);

  // Form step state: 'form' | 'otp' | 'success'
  const [step, setStep] = useState<'form' | 'otp' | 'success'>('form');

  // Cached form data for submission after OTP verification
  const [cachedFormData, setCachedFormData] = useState<FormData | null>(null);
  const [targetEmail, setTargetEmail] = useState('');
  const [enquiryNumber, setEnquiryNumber] = useState('');

  // Field validation states
  const [phoneValid, setPhoneValid] = useState(false);
  const [phoneValue, setPhoneValue] = useState({ dialCode: '+91', number: '' });
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(true);
  const [whatsappValue, setWhatsappValue] = useState({ dialCode: '+91', number: '' });
  const [dateError, setDateError] = useState<string | null>(null);

  // Package validation: true if packageId is set initially or when user selects a real package
  const hasPackageSelector = !!(availablePackages && availablePackages.length > 0);
  const [packageValid, setPackageValid] = useState(Boolean(packageId) || !hasPackageSelector);

  // Form error & loading states
  const [formError, setFormError] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  // OTP step states
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const todayStr = getTodayString();

  // Reset form when navigating away or when navbar "Book With Us" CTA is clicked
  const handleResetToFreshForm = useCallback(() => {
    setStep('form');
    setCachedFormData(null);
    setOtpDigits(['', '', '', '', '', '']);
    setOtpError(null);
    setFormError(null);
    setEnquiryNumber('');
  }, []);

  useEffect(() => {
    // Reset if pathname changes
    if (pathname !== prevPathnameRef.current) {
      prevPathnameRef.current = pathname;
      handleResetToFreshForm();
    }
  }, [pathname, handleResetToFreshForm]);

  useEffect(() => {
    // Listen for custom reset event dispatched by navbar "Book With Us" button
    const onResetBooking = () => {
      handleResetToFreshForm();
    };
    window.addEventListener('travinco:reset-booking-form', onResetBooking);
    return () => window.removeEventListener('travinco:reset-booking-form', onResetBooking);
  }, [handleResetToFreshForm]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((c) => Math.max(c - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (!val) {
      setDateError('Travel date is required.');
    } else if (val < todayStr) {
      setDateError('Travel date cannot be in the past.');
    } else {
      setDateError(null);
    }
  }

  // Step 1: Submit Form -> Validate & Send Email OTP
  async function handleInitialSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    const formEl = e.currentTarget;
    const formData = new FormData(formEl);

    // Validate phone
    if (!phoneValid) {
      setFormError('Please enter a valid contact phone number.');
      return;
    }

    // Validate travel date
    const dateVal = formData.get('travel_date')?.toString();
    if (!dateVal || dateVal < todayStr) {
      setDateError('Travel date cannot be in the past.');
      setFormError('Travel date cannot be in the past.');
      return;
    }

    // Validate package selection
    if (hasPackageSelector && !packageValid) {
      setFormError('Please select a tour package to continue.');
      return;
    }

    const emailVal = formData.get('email')?.toString()?.trim() || '';
    if (!emailVal || !emailVal.includes('@')) {
      setFormError('Please enter a valid email address.');
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await requestEnquiryOtp(formData);
      if (res.error) {
        setFormError(res.error);
        setIsSendingOtp(false);
        return;
      }

      // Success: Save form data and transition to OTP step
      setCachedFormData(formData);
      setTargetEmail(emailVal);
      setOtpDigits(['', '', '', '', '', '']);
      setOtpError(null);
      setCooldown(60);
      setStep('otp');
    } catch (err: any) {
      setFormError(err?.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  }

  // Resend OTP code
  async function handleResendOtp() {
    if (cooldown > 0 || !cachedFormData || isSendingOtp) return;

    setIsSendingOtp(true);
    setOtpError(null);
    try {
      const res = await requestEnquiryOtp(cachedFormData);
      if (res.error) {
        setOtpError(res.error);
      } else {
        setCooldown(60);
      }
    } catch {
      setOtpError('Failed to resend code. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  }

  // Step 2: Verify OTP -> Save Enquiry to Database
  async function handleVerifyOtp(codeToVerify?: string) {
    const code = (codeToVerify || otpDigits.join('')).trim();
    if (code.length !== 6) {
      setOtpError('Please enter all 6 digits of your verification code.');
      return;
    }

    if (!cachedFormData || isVerifyingOtp) return;

    setIsVerifyingOtp(true);
    setOtpError(null);

    try {
      const result = await verifyEnquiryOtpAndSubmit(cachedFormData, code);
      if (result.error) {
        setOtpError(result.error);
        setIsVerifyingOtp(false);
        return;
      }

      setEnquiryNumber(result.enquiryNumber || 'ENQ-CONFIRMED');
      setStep('success');
    } catch (err: any) {
      setOtpError(err?.message || 'Verification failed. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  }

  // ── Success State ────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="rounded-3xl border border-brand-200 bg-brand-50/60 p-8 sm:p-10 text-center shadow-sm animate-in fade-in zoom-in-95 duration-400">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-600 mb-4">
          <CheckCircle2 className="h-10 w-10 text-brand-600" />
        </div>
        <h2 className="font-display text-2xl font-bold text-brand-950 sm:text-3xl">
          Thank you — we&apos;ve got your enquiry!
        </h2>
        <p className="mt-3 text-base text-brand-800 max-w-md mx-auto leading-relaxed">
          Reference number <strong className="font-bold text-brand-900">{enquiryNumber}</strong>. Our travel team will reach out shortly with your tailored itinerary and quote.
        </p>
      </div>
    );
  }

  // ── OTP Verification State ──────────────────────────────────────────────────
  if (step === 'otp') {
    return (
      <div className="rounded-3xl border border-ink-150 bg-white p-6 sm:p-10 shadow-xl shadow-ink-900/5 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 mb-4">
            <Mail className="h-7 w-7 text-brand-600" />
          </div>

          <h2 className="font-display text-2xl font-bold text-ink-900">
            Verify Your Email
          </h2>
          <p className="mt-2 text-sm text-ink-500">
            We sent a 6-digit verification code to{' '}
            <strong className="font-semibold text-ink-800">{targetEmail}</strong>.
            Please enter it below to confirm your enquiry request.
          </p>

          <div className="mt-6">
            <OtpInputBoxes
              value={otpDigits}
              onChange={setOtpDigits}
              onComplete={(fullCode) => handleVerifyOtp(fullCode)}
              disabled={isVerifyingOtp}
            />
          </div>

          {otpError && (
            <div className="mt-4 rounded-xl bg-coral-50 border border-coral-200 p-3 text-sm text-coral-700">
              {otpError}
            </div>
          )}

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => handleVerifyOtp()}
              disabled={otpDigits.join('').length !== 6 || isVerifyingOtp}
              className="btn-primary w-full py-3.5 text-sm font-semibold shadow-md flex items-center justify-center gap-2"
            >
              {isVerifyingOtp ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying &amp; Submitting…</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Verify &amp; Submit Enquiry</span>
                </>
              )}
            </button>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-ink-500">
              <button
                type="button"
                onClick={() => setStep('form')}
                className="inline-flex items-center gap-1.5 font-medium text-ink-600 hover:text-ink-900 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Change details / Back</span>
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={cooldown > 0 || isSendingOtp}
                className={`inline-flex items-center gap-1 font-medium transition-colors ${
                  cooldown > 0
                    ? 'text-ink-400 cursor-not-allowed'
                    : 'text-brand-600 hover:text-brand-700 hover:underline'
                }`}
              >
                <RefreshCw className={`h-3 w-3 ${isSendingOtp ? 'animate-spin' : ''}`} />
                <span>
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Split 2-Column Layout (Booking Page) ──────────────────────────────────
  if (layout === 'split') {
    return (
      <form onSubmit={handleInitialSubmit} className="space-y-6">
        <div className="hidden" aria-hidden="true">
          <label htmlFor="website">Leave this field empty</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        {(!availablePackages || availablePackages.length === 0) && packageId && (
          <input type="hidden" name="package_id" value={packageId} />
        )}
        {destinationName && <input type="hidden" name="destination" value={destinationName} />}

        <div className="grid gap-6 md:grid-cols-2 md:gap-8">
          {/* ── Left Column: Contact Details ─────────────────────────── */}
          <div className="space-y-4 rounded-xl border border-ink-100 bg-sand-50/40 p-4 sm:p-5">
            <div className="flex items-center gap-2 border-b border-ink-200/60 pb-2">
              <User className="h-4 w-4 text-brand-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-700">
                1. Your Contact Details
              </h2>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-ink-600">Full Name *</label>
              <input
                name="customer_name"
                required
                defaultValue={defaultName}
                placeholder="Enter your full name"
                className="input bg-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-ink-600">
                Email Address * <span className="text-[11px] font-normal text-ink-400">(verified via OTP)</span>
              </label>
              <input
                name="email"
                type="email"
                required
                defaultValue={defaultEmail}
                placeholder="name@example.com"
                className="input bg-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-ink-600">Phone Number *</label>
              <PhoneInput
                name="phone"
                required
                placeholder="Mobile number"
                onValidityChange={setPhoneValid}
                value={phoneValue}
                onChange={setPhoneValue}
              />
            </div>

            <div className="pt-1">
              <label className="flex items-center gap-2 text-xs text-ink-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={whatsappSameAsPhone}
                  onChange={(e) => setWhatsappSameAsPhone(e.target.checked)}
                  className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                />
                Same number for WhatsApp updates
              </label>

              {whatsappSameAsPhone ? (
                <input
                  type="hidden"
                  name="whatsapp_number"
                  value={phoneValue.number ? `${phoneValue.dialCode}${phoneValue.number}` : ''}
                />
              ) : (
                <div className="mt-2.5">
                  <label className="mb-1 block text-xs font-medium text-ink-600">WhatsApp Number</label>
                  <PhoneInput
                    name="whatsapp_number"
                    placeholder="WhatsApp number"
                    value={whatsappValue}
                    onChange={setWhatsappValue}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── Right Column: Package Request Details ────────────────── */}
          <div className="space-y-4 rounded-xl border border-ink-100 bg-sand-50/40 p-4 sm:p-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-ink-200/60 pb-2">
                <Compass className="h-4 w-4 text-brand-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-ink-700">
                  2. Trip &amp; Package Details
                </h2>
              </div>

              {availablePackages && availablePackages.length > 0 && (
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-600">
                    <Package className="h-3.5 w-3.5 text-brand-600" />
                    <span>Choose Tour Package *</span>
                  </label>
                  <PackageCombobox
                    packages={availablePackages}
                    defaultId={packageId || ''}
                    inputClassName="input bg-white text-ink-800 font-medium w-full"
                    onValidityChange={setPackageValid}
                  />
                </div>
              )}

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-600">
                  <Calendar className="h-3.5 w-3.5 text-ink-400" />
                  <span>When are you planning to travel? *</span>
                </label>
                <input
                  name="travel_date"
                  type="date"
                  required
                  min={todayStr}
                  onChange={handleDateChange}
                  className={`input bg-white ${dateError ? 'border-coral-400 focus:ring-coral-400' : ''}`}
                />
                {dateError && (
                  <p className="mt-1 text-xs text-coral-600">{dateError}</p>
                )}
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-600">
                  <Users className="h-3.5 w-3.5 text-ink-400" />
                  <span>Number of Guests</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="mb-0.5 block text-[10px] text-ink-400">Adults (12+)</span>
                    <input
                      name="number_of_adults"
                      type="number"
                      min={1}
                      defaultValue={2}
                      className="input bg-white text-center px-1"
                    />
                  </div>
                  <div>
                    <span className="mb-0.5 block text-[10px] text-ink-400">Kids (2–11)</span>
                    <input
                      name="number_of_children"
                      type="number"
                      min={0}
                      defaultValue={0}
                      className="input bg-white text-center px-1"
                    />
                  </div>
                  <div>
                    <span className="mb-0.5 block text-[10px] text-ink-400">Infants (&lt;2)</span>
                    <input
                      name="number_of_infants"
                      type="number"
                      min={0}
                      defaultValue={0}
                      className="input bg-white text-center px-1"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-600">
                  Approximate Budget (₹, optional)
                </label>
                <input
                  name="budget"
                  type="number"
                  min={0}
                  placeholder="e.g. 50000"
                  className="input bg-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-600">
                  Special Requests / Notes
                </label>
                <textarea
                  name="message"
                  rows={2}
                  placeholder="Destinations, hotel preferences, activities…"
                  className="input bg-white resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Actions & Submit ────────────────────────────────────────── */}
        <div className="pt-2 space-y-2">
          {formError && (
            <p className="rounded-xl bg-coral-50 border border-coral-200 px-3.5 py-2.5 text-sm text-coral-700">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={!phoneValid || !!dateError || !packageValid || isSendingOtp}
            className="btn-primary w-full py-3.5 text-sm font-semibold shadow-md flex items-center justify-center gap-2"
          >
            {isSendingOtp ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Sending Verification Code…</span>
              </>
            ) : (
              <span>{buttonLabel}</span>
            )}
          </button>

          {!phoneValid && (
            <p className="text-center text-xs text-ink-400">
              Please enter a valid phone number for the selected country to submit.
            </p>
          )}
        </div>
      </form>
    );
  }

  // ── Standard Stacked Layout (e.g. Package Detail Sidebar) ──────────────────
  return (
    <form onSubmit={handleInitialSubmit} className="space-y-3">
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {(!availablePackages || availablePackages.length === 0) && packageId && (
        <input type="hidden" name="package_id" value={packageId} />
      )}
      {destinationName && <input type="hidden" name="destination" value={destinationName} />}

      <div className="space-y-3 rounded-xl2 border border-ink-100 bg-ink-50/40 p-4">
        {availablePackages && availablePackages.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">Choose Package *</label>
            <PackageCombobox
              packages={availablePackages}
              defaultId={packageId || ''}
              inputClassName="input bg-white w-full"
              onValidityChange={setPackageValid}
            />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            name="customer_name"
            required
            defaultValue={defaultName}
            placeholder="Full name*"
            className="input"
          />
          <input
            name="email"
            type="email"
            required
            defaultValue={defaultEmail}
            placeholder="Email (verified via OTP)*"
            className="input"
          />
        </div>

        <div>
          <PhoneInput
            name="phone"
            required
            placeholder="Phone number*"
            onValidityChange={setPhoneValid}
            value={phoneValue}
            onChange={setPhoneValue}
          />
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-2 text-sm text-ink-600">
            <input
              type="checkbox"
              checked={whatsappSameAsPhone}
              onChange={(e) => setWhatsappSameAsPhone(e.target.checked)}
              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            Same number for WhatsApp
          </label>
          {whatsappSameAsPhone ? (
            <input
              type="hidden"
              name="whatsapp_number"
              value={phoneValue.number ? `${phoneValue.dialCode}${phoneValue.number}` : ''}
            />
          ) : (
            <PhoneInput
              name="whatsapp_number"
              placeholder="WhatsApp number"
              value={whatsappValue}
              onChange={setWhatsappValue}
            />
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">When are you traveling? *</label>
          <input
            name="travel_date"
            type="date"
            required
            min={todayStr}
            onChange={handleDateChange}
            className={`input ${dateError ? 'border-coral-400 focus:ring-coral-400' : ''}`}
          />
          {dateError && (
            <p className="mt-1 text-xs text-coral-600">{dateError}</p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">Adults (12+ yrs)</label>
            <input
              name="number_of_adults"
              type="number"
              min={1}
              defaultValue={2}
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">Children (2–11 yrs)</label>
            <input
              name="number_of_children"
              type="number"
              min={0}
              defaultValue={0}
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">Infants (below 2 yrs)</label>
            <input
              name="number_of_infants"
              type="number"
              min={0}
              defaultValue={0}
              className="input"
            />
          </div>
        </div>
        <input name="budget" type="number" min={0} placeholder="Approximate budget (optional)" className="input" />
        <textarea
          name="message"
          rows={3}
          placeholder="Tell us a bit about your trip…"
          className="input"
        />
      </div>

      {formError && (
        <p className="rounded-xl bg-coral-50 border border-coral-200 px-3.5 py-2.5 text-sm text-coral-700">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={!phoneValid || !!dateError || !packageValid || isSendingOtp}
        className="btn-primary w-full py-3.5 text-sm font-semibold shadow-md flex items-center justify-center gap-2"
      >
        {isSendingOtp ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Sending Verification Code…</span>
          </>
        ) : (
          <span>{buttonLabel}</span>
        )}
      </button>

      {!phoneValid && (
        <p className="text-center text-xs text-ink-400">
          Please enter a valid phone number for the selected country.
        </p>
      )}
    </form>
  );
}
