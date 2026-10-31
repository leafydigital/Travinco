'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { requestEnquiryOtp, verifyEnquiryOtpAndSubmit } from '@/app/(public)/actions';
import { PhoneInput } from './phone-input';
import { DatePickerDMY } from './date-picker-dmy';
import {
  CheckCircle2,
  User,
  Compass,
  Calendar,
  Users,
  Package,
  ChevronDown,
  X,
  Mail,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  RefreshCw,
} from 'lucide-react';

/** Returns earliest travel date (today + 2 days) in YYYY-MM-DD format (local time) and display string (DD/MM/YYYY). */
function getMinTravelDate(): { iso: string; display: string } {
  const d = new Date();
  d.setDate(d.getDate() + 2); // strictly at least 2 days in advance
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return {
    iso: `${yyyy}-${mm}-${dd}`,
    display: `${dd}/${mm}/${yyyy}`,
  };
}

/** Latest travel date: exactly 1 year from today (YYYY-MM-DD, local time). */
function getMaxTravelDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ─── Package Combobox (Pick from the full list or type a custom package) ──────

// Not a submittable value: choosing it clears the field so the visitor types their own trip name.
const CUSTOM_TOUR_OPTION = { id: '', title: 'Custom Tour / Tailored Trip — type your own package name' };

function PackageCombobox({
  packages,
  defaultId = '',
  defaultCustomTitle = '',
  inputClassName = '',
  onValidityChange,
  onChange,
}: {
  packages: { id: string; title: string }[];
  defaultId?: string;
  defaultCustomTitle?: string;
  inputClassName?: string;
  onValidityChange?: (valid: boolean) => void;
  onChange?: (val: { package_id: string; custom_package_name: string }) => void;
}) {
  const allOptions = useMemo(() => [CUSTOM_TOUR_OPTION, ...packages], [packages]);
  const initialPkg =
    packages.find((p) => p.id === defaultId) ??
    (defaultId === '' && !defaultCustomTitle ? CUSTOM_TOUR_OPTION : null);

  const [query, setQuery] = useState(
    defaultCustomTitle || (initialPkg?.id ? initialPkg.title : '')
  );
  const [selectedId, setSelectedId] = useState(defaultId);
  const [isOpen, setIsOpen] = useState(false);
  // -1 = nothing highlighted (Enter keeps the typed custom text)
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [touched, setTouched] = useState(false);
  // True after choosing "Custom Tour": prompts the visitor to type their own name
  const [customMode, setCustomMode] = useState(false);

  // Sync with defaultId or defaultCustomTitle if they change externally
  useEffect(() => {
    if (defaultId) {
      const match = packages.find((p) => p.id === defaultId);
      if (match) {
        setSelectedId(defaultId);
        setQuery(match.title);
        onValidityChange?.(true);
      }
    } else if (defaultCustomTitle) {
      setSelectedId('');
      setQuery(defaultCustomTitle);
      onValidityChange?.(true);
    }
  }, [defaultId, defaultCustomTitle, packages, onValidityChange]);

  const isValid = Boolean(selectedId || query.trim());
  const showError = touched && !isValid;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Typing never filters: the dropdown always lists every package, and the typed
  // text is offered as a custom package at the top.
  const filtered = allOptions;

  const hasExactMatch = packages.some(
    (p) => p.title.toLowerCase() === query.trim().toLowerCase()
  );
  const showCustomOption = query.trim().length > 0 && !hasExactMatch;

  // Close when clicking outside.
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setTouched(true);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Scroll highlighted item into view (offset by the custom row when it's shown).
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) return;
    const offset = showCustomOption ? 1 : 0;
    const el = listRef.current?.children[highlightedIndex + offset] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen, showCustomOption]);

  function selectOption(option: { id: string; title: string }) {
    if (option === CUSTOM_TOUR_OPTION) {
      // Don't submit the placeholder text: clear the field and let the visitor type
      setSelectedId('');
      setQuery('');
      setCustomMode(true);
      setIsOpen(false);
      setHighlightedIndex(-1);
      onValidityChange?.(false);
      onChange?.({ package_id: '', custom_package_name: '' });
      inputRef.current?.focus();
      return;
    }
    setCustomMode(false);
    setSelectedId(option.id);
    setQuery(option.id ? option.title : '');
    setIsOpen(false);
    setHighlightedIndex(-1);
    setTouched(true);
    onValidityChange?.(Boolean(option.id || option.title));
    onChange?.({ package_id: option.id, custom_package_name: option.id ? '' : option.title });
  }

  function handleInputChange(val: string) {
    setQuery(val);
    setIsOpen(true);
    setHighlightedIndex(-1);
    const match = packages.find((p) => p.title.toLowerCase() === val.trim().toLowerCase());
    const nextId = match ? match.id : '';
    setSelectedId(nextId);
    onValidityChange?.(Boolean(nextId || val.trim()));
    onChange?.({ package_id: nextId, custom_package_name: nextId ? '' : val.trim() });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true);
        setHighlightedIndex(-1);
      }
      if (e.key === 'Enter') e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Only pick a list item when the user moved to it with the arrow keys;
      // otherwise Enter confirms the typed custom package.
      if (highlightedIndex >= 0 && filtered[highlightedIndex]) {
        selectOption(filtered[highlightedIndex]);
      } else if (query.trim()) {
        setSelectedId('');
        setIsOpen(false);
        onValidityChange?.(true);
        onChange?.({ package_id: '', custom_package_name: query.trim() });
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  const showClearButton = Boolean(selectedId || query.trim());

  return (
    <div ref={wrapperRef} className="relative">
      <input type="hidden" name="package_id" value={selectedId} />
      <input type="hidden" name="custom_package_name" value={selectedId ? '' : query.trim()} />

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          autoComplete="off"
          placeholder={customMode ? 'Type your custom package name…' : 'Select a package or type your own'}
          value={query}
          onFocus={() => {
            // In custom mode keep the list closed so the visitor can just type
            if (!customMode) setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`${inputClassName} pr-16 ${showError ? 'border-coral-400 focus:ring-coral-400 bg-coral-50/20' : ''}`}
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="package-options-list"
          aria-haspopup="listbox"
          aria-label="Choose or enter tour package"
          aria-required="true"
        />
        <span className="absolute inset-y-0 right-0 flex items-center gap-0.5 pr-2">
          {showClearButton && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                setSelectedId('');
                setQuery('');
                setCustomMode(false);
                setIsOpen(false);
                onValidityChange?.(false);
                onChange?.({ package_id: '', custom_package_name: '' });
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
          {showCustomOption && (
            <li
              role="option"
              aria-selected={!selectedId && !!query.trim()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setSelectedId('');
                setIsOpen(false);
                onValidityChange?.(true);
                onChange?.({ package_id: '', custom_package_name: query.trim() });
              }}
              className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm bg-brand-50/80 text-brand-800 font-medium hover:bg-brand-100 border-b border-brand-100"
            >
              <span>Custom package: &ldquo;{query.trim()}&rdquo;</span>
            </li>
          )}
          {filtered.map((option, idx) => {
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
                  className={`flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm transition-colors ${isHighlighted ? 'bg-brand-50 text-brand-800' : 'text-ink-700 hover:bg-ink-50'
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
            })}
        </ul>
      )}
      {showError && (
        <p className="mt-1 text-xs text-coral-600 font-medium">
          {customMode
            ? 'Please type your custom package name to continue.'
            : 'Please select or enter a tour package to continue.'}
        </p>
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
  compact = false,
  availablePackages,
}: {
  packageId?: string;
  destinationName?: string;
  buttonLabel?: string;
  isLoggedIn?: boolean;
  defaultName?: string;
  defaultEmail?: string;
  layout?: 'stacked' | 'split';
  /** Tighter spacing for the split layout (package page enquiry modal: fits without scrolling). */
  compact?: boolean;
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

  // Controlled form values so data is 100% preserved when returning from OTP screen
  const [formValues, setFormValues] = useState({
    customer_name: defaultName,
    email: defaultEmail,
    package_id: packageId || '',
    custom_package_name: '',
    travel_date: '',
    number_of_adults: 2,
    number_of_children: 0,
    number_of_infants: 0,
    budget: '',
    message: '',
  });

  // Sync external defaults if props change
  useEffect(() => {
    if (defaultName) setFormValues((v) => ({ ...v, customer_name: v.customer_name || defaultName }));
  }, [defaultName]);
  useEffect(() => {
    if (defaultEmail) setFormValues((v) => ({ ...v, email: v.email || defaultEmail }));
  }, [defaultEmail]);
  useEffect(() => {
    if (packageId) setFormValues((v) => ({ ...v, package_id: v.package_id || packageId }));
  }, [packageId]);

  // Field validation error states
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);
  const [dateTouched, setDateTouched] = useState(false);

  // Phone state
  const [phoneValid, setPhoneValid] = useState(false);
  const [phoneValue, setPhoneValue] = useState({ dialCode: '+91', number: '' });
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(true);
  const [whatsappValue, setWhatsappValue] = useState({ dialCode: '+91', number: '' });

  // Package validation: true if packageId is set initially or when user selects/types a package
  const hasPackageSelector = !!(availablePackages && availablePackages.length > 0);
  const [packageValid, setPackageValid] = useState(Boolean(packageId) || !hasPackageSelector);

  // Form error & loading states
  const [formError, setFormError] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  // OTP step states & double-submit ref lock
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const isVerifyingRef = useRef(false);
  const [cooldown, setCooldown] = useState(0);

  const minTravelDate = useMemo(() => getMinTravelDate(), []);
  const maxTravelDate = useMemo(() => getMaxTravelDate(), []);

  // Validation functions
  function validateName(val: string): string | null {
    const trimmed = val.trim();
    if (!trimmed) {
      return 'Full name is required';
    }
    if (/\d/.test(val)) {
      return 'Enter valid full name';
    }
    if (!/^[a-zA-Z\s'.\-]+$/.test(trimmed)) {
      return 'Full name can only contain letters and spaces';
    }
    return null;
  }

  function handleNameChange(val: string) {
    setFormValues((prev) => ({ ...prev, customer_name: val }));
    if (/\d/.test(val)) {
      setNameError('Enter valid full name');
    } else if (nameTouched) {
      setNameError(validateName(val));
    } else {
      setNameError(null);
    }
  }

  function handleNameBlur() {
    setNameTouched(true);
    setNameError(validateName(formValues.customer_name));
  }

  function validateEmail(val: string): string | null {
    const trimmed = val.trim();
    if (!trimmed) {
      return 'Email address is required';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return 'Please enter a valid email address';
    }
    return null;
  }

  function handleEmailChange(val: string) {
    setFormValues((prev) => ({ ...prev, email: val }));
    if (emailTouched) {
      setEmailError(validateEmail(val));
    } else {
      setEmailError(null);
    }
  }

  function handleEmailBlur() {
    setEmailTouched(true);
    setEmailError(validateEmail(formValues.email));
  }

  function validateDate(val: string): string | null {
    if (!val) {
      return 'Please select a travel date';
    }
    const minDate = getMinTravelDate();
    if (val < minDate.iso) {
      return 'Please choose a date at least 2 days from today';
    }
    if (val > getMaxTravelDate()) {
      return 'Please choose a date within 1 year from today';
    }
    return null;
  }

  function handleDateChange(val: string) {
    setFormValues((prev) => ({ ...prev, travel_date: val }));
    setDateTouched(true);
    setDateError(validateDate(val));
  }

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

  // ── Keep the visitor's details when they leave and come back ─────────────
  // e.g. "Browse Packages →" then the browser Back button: the page reloads
  // the form, so the typed details are restored from this browser tab's session.
  const draftKey = `travinco:enquiry-draft:${packageId || 'general'}`;
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft?.formValues) {
          setFormValues((v) => ({
            ...v,
            ...draft.formValues,
            // A package chosen for this page wins over an older draft's choice
            package_id: packageId || draft.formValues.package_id || '',
            // Logged-in customers keep their account details
            customer_name: defaultName || draft.formValues.customer_name || '',
            email: defaultEmail || draft.formValues.email || '',
          }));
        }
        if (draft?.phoneValue?.number) setPhoneValue(draft.phoneValue);
        if (typeof draft?.whatsappSameAsPhone === 'boolean') setWhatsappSameAsPhone(draft.whatsappSameAsPhone);
        if (draft?.whatsappValue?.number) setWhatsappValue(draft.whatsappValue);
      }
    } catch {
      // Storage blocked or bad JSON: start with an empty form
    }
    setDraftReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (!draftReady || step === 'success') return;
    try {
      window.sessionStorage.setItem(
        draftKey,
        JSON.stringify({ formValues, phoneValue, whatsappSameAsPhone, whatsappValue })
      );
    } catch {
      // Storage full or blocked: nothing to keep
    }
  }, [draftReady, draftKey, step, formValues, phoneValue, whatsappSameAsPhone, whatsappValue]);

  // ── Browser Back button on the OTP screen returns to the form ────────────
  // Showing the OTP step adds a history entry for the same page, so the
  // browser's Back arrow lands on the form (with the details kept) instead
  // of leaving the page.
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    function onPopState(e: PopStateEvent) {
      if ((e.state as { travincoEnquiryOtp?: boolean } | null)?.travincoEnquiryOtp) return;
      if (stepRef.current === 'otp') {
        setStep('form');
        setOtpError(null);
        setFormError(null);
      } else if (stepRef.current === 'success') {
        // Skip the form entry the OTP step left behind; go where the visitor came from
        window.history.back();
      }
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  function goBackToForm() {
    if ((window.history.state as { travincoEnquiryOtp?: boolean } | null)?.travincoEnquiryOtp) {
      // Pops the OTP history entry; the popstate listener shows the form
      window.history.back();
    } else {
      setStep('form');
    }
    setOtpError(null);
    setFormError(null);
  }

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((c) => Math.max(c - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Step 1: Submit Form -> Validate & Send Email OTP
  async function handleInitialSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    // Validate name
    const nameErr = validateName(formValues.customer_name);
    setNameTouched(true);
    if (nameErr) {
      setNameError(nameErr);
      setFormError(nameErr);
      return;
    }

    // Validate email
    const mailErr = validateEmail(formValues.email);
    setEmailTouched(true);
    if (mailErr) {
      setEmailError(mailErr);
      setFormError(mailErr);
      return;
    }

    // Validate phone
    if (!phoneValid) {
      setFormError('Enter a valid mobile number');
      return;
    }

    // Validate package selection / entry
    if (hasPackageSelector && !packageValid && !formValues.package_id && !formValues.custom_package_name.trim()) {
      setFormError('Please choose or enter a tour package to continue.');
      return;
    }

    // Validate travel date (min 2 days in advance)
    const dErr = validateDate(formValues.travel_date);
    setDateTouched(true);
    if (dErr) {
      setDateError(dErr);
      setFormError(dErr);
      return;
    }

    // Prepare complete form data from controlled state
    const formEl = e.currentTarget;
    const formData = new FormData(formEl);

    formData.set('customer_name', formValues.customer_name.trim());
    formData.set('email', formValues.email.trim());

    const phoneFull = phoneValue.number ? `${phoneValue.dialCode}${phoneValue.number}` : '';
    formData.set('phone', phoneFull);

    const whatsappFull = whatsappSameAsPhone
      ? phoneFull
      : (whatsappValue.number ? `${whatsappValue.dialCode}${whatsappValue.number}` : '');
    formData.set('whatsapp_number', whatsappFull);

    if (formValues.package_id) {
      formData.set('package_id', formValues.package_id);
    } else {
      formData.delete('package_id');
    }
    formData.set('custom_package_name', formValues.custom_package_name.trim());

    if (destinationName) {
      formData.set('destination', destinationName);
    }

    formData.set('travel_date', formValues.travel_date);
    formData.set('number_of_adults', String(formValues.number_of_adults || 1));
    formData.set('number_of_children', String(formValues.number_of_children || 0));
    formData.set('number_of_infants', String(formValues.number_of_infants || 0));

    if (formValues.budget && String(formValues.budget).trim()) {
      formData.set('budget', String(formValues.budget).trim());
    } else {
      formData.delete('budget');
    }

    formData.set('message', formValues.message.trim());

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
      setTargetEmail(formValues.email.trim());
      setOtpDigits(['', '', '', '', '', '']);
      setOtpError(null);
      setCooldown(60);
      setStep('otp');
      if (!(window.history.state as { travincoEnquiryOtp?: boolean } | null)?.travincoEnquiryOtp) {
        window.history.pushState({ ...window.history.state, travincoEnquiryOtp: true }, '', window.location.href);
      }
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

    if (!cachedFormData || isVerifyingRef.current) return;
    isVerifyingRef.current = true;
    setIsVerifyingOtp(true);
    setOtpError(null);

    try {
      const result = await verifyEnquiryOtpAndSubmit(cachedFormData, code);
      if (result.error) {
        setOtpError(result.error);
        return;
      }

      setEnquiryNumber(result.enquiryNumber || 'ENQ-CONFIRMED');
      setStep('success');
      try {
        window.sessionStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
    } catch (err: any) {
      setOtpError(err?.message || 'Verification failed. Please try again.');
    } finally {
      isVerifyingRef.current = false;
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

            <button
              type="button"
              onClick={goBackToForm}
              disabled={isVerifyingOtp}
              className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink-200 bg-white px-5 py-3.5 text-sm font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50 hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back — change my details</span>
            </button>

            <div className="flex justify-center pt-1 text-sm">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={cooldown > 0 || isSendingOtp}
                className={`inline-flex items-center gap-1.5 font-medium transition-colors ${cooldown > 0
                  ? 'text-ink-400 cursor-not-allowed'
                  : 'text-brand-600 hover:text-brand-700 hover:underline'
                  }`}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSendingOtp ? 'animate-spin' : ''}`} />
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
      <form
        onSubmit={handleInitialSubmit}
        className={compact ? 'space-y-3 [&_.input]:py-2 [&_.input]:text-sm' : 'space-y-6'}
        noValidate
      >
        <div className="hidden" aria-hidden="true">
          <label htmlFor="website">Leave this field empty</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        {(!availablePackages || availablePackages.length === 0) && packageId && (
          <input type="hidden" name="package_id" value={packageId} />
        )}
        {destinationName && <input type="hidden" name="destination" value={destinationName} />}

        <div className={compact ? 'grid gap-3 md:grid-cols-2 md:gap-4' : 'grid gap-6 md:grid-cols-2 md:gap-8'}>
          {/* ── Left Column: Contact Details ─────────────────────────── */}
          <div className={`rounded-xl border border-ink-100 bg-sand-50/40 ${compact ? 'space-y-2.5 p-3 sm:p-4' : 'space-y-4 p-4 sm:p-5'}`}>
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
                type="text"
                required
                value={formValues.customer_name}
                onChange={(e) => handleNameChange(e.target.value)}
                onBlur={handleNameBlur}
                placeholder="Enter your full name"
                className={`input bg-white ${nameError ? 'border-coral-400 focus:ring-coral-400 bg-coral-50/20' : ''}`}
                aria-invalid={Boolean(nameError)}
              />
              {nameError && (
                <p className="mt-1 text-xs text-coral-600 font-medium">{nameError}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-ink-600">
                Email Address * <span className="text-[11px] font-normal text-ink-400">(verified via OTP)</span>
              </label>
              <input
                name="email"
                type="email"
                required
                value={formValues.email}
                onChange={(e) => handleEmailChange(e.target.value)}
                onBlur={handleEmailBlur}
                placeholder="name@example.com"
                className={`input bg-white ${emailError ? 'border-coral-400 focus:ring-coral-400 bg-coral-50/20' : ''}`}
                aria-invalid={Boolean(emailError)}
              />
              {emailError && (
                <p className="mt-1 text-xs text-coral-600 font-medium">{emailError}</p>
              )}
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
          <div className={`rounded-xl border border-ink-100 bg-sand-50/40 flex flex-col justify-between ${compact ? 'space-y-2.5 p-3 sm:p-4' : 'space-y-4 p-4 sm:p-5'}`}>
            <div className={compact ? 'space-y-2.5' : 'space-y-4'}>
              <div className="flex items-center gap-2 border-b border-ink-200/60 pb-2">
                <Compass className="h-4 w-4 text-brand-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-ink-700">
                  2. Trip &amp; Package Details
                </h2>
              </div>

              {availablePackages && availablePackages.length > 0 && (
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-ink-600">
                      <Package className="h-3.5 w-3.5 text-brand-600" />
                      <span>Choose Tour Package *</span>
                    </label>
                    <Link
                      href="/packages"
                      className="shrink-0 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                    >
                      Browse Packages →
                    </Link>
                  </div>
                  <PackageCombobox
                    packages={availablePackages}
                    defaultId={formValues.package_id}
                    defaultCustomTitle={formValues.custom_package_name}
                    inputClassName="input bg-white text-ink-800 font-medium w-full"
                    onValidityChange={setPackageValid}
                    onChange={({ package_id, custom_package_name }) => {
                      setFormValues((prev) => ({
                        ...prev,
                        package_id,
                        custom_package_name,
                      }));
                    }}
                  />
                </div>
              )}

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-600">
                  <Calendar className="h-3.5 w-3.5 text-ink-400" />
                  <span>When are you planning to travel? *</span>
                </label>
                <DatePickerDMY
                  name="travel_date"
                  min={minTravelDate.iso}
                  max={maxTravelDate}
                  value={formValues.travel_date}
                  onChange={handleDateChange}
                  onClose={() => {
                    setDateTouched(true);
                    setDateError(validateDate(formValues.travel_date));
                  }}
                  invalid={Boolean(dateError)}
                />
                {dateError && (
                  <p className="mt-1 text-xs text-coral-600 font-medium">{dateError}</p>
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
                      value={formValues.number_of_adults}
                      onChange={(e) => setFormValues((prev) => ({ ...prev, number_of_adults: Number(e.target.value) || 1 }))}
                      className="input bg-white text-center px-1"
                    />
                  </div>
                  <div>
                    <span className="mb-0.5 block text-[10px] text-ink-400">Kids (2–11)</span>
                    <input
                      name="number_of_children"
                      type="number"
                      min={0}
                      value={formValues.number_of_children}
                      onChange={(e) => setFormValues((prev) => ({ ...prev, number_of_children: Number(e.target.value) || 0 }))}
                      className="input bg-white text-center px-1"
                    />
                  </div>
                  <div>
                    <span className="mb-0.5 block text-[10px] text-ink-400">Infants (&lt;2)</span>
                    <input
                      name="number_of_infants"
                      type="number"
                      min={0}
                      value={formValues.number_of_infants}
                      onChange={(e) => setFormValues((prev) => ({ ...prev, number_of_infants: Number(e.target.value) || 0 }))}
                      className="input bg-white text-center px-1"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-600">
                  Approx. Budget per Person (₹) — Optional
                </label>
                <input
                  name="budget"
                  type="number"
                  step="any"
                  min={0}
                  value={formValues.budget}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, budget: e.target.value }))}
                  placeholder="e.g. 25000"
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
                  value={formValues.message}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, message: e.target.value }))}
                  placeholder="Destinations, hotel preferences, activities…"
                  maxLength={2000}
                  className="input bg-white resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Actions & Submit ────────────────────────────────────────── */}
        <div className={compact ? 'space-y-2' : 'pt-2 space-y-2'}>
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

          {!phoneValid && !compact && (
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
    <form onSubmit={handleInitialSubmit} className="space-y-3" noValidate>
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
              defaultId={formValues.package_id}
              defaultCustomTitle={formValues.custom_package_name}
              inputClassName="input bg-white w-full"
              onValidityChange={setPackageValid}
              onChange={({ package_id, custom_package_name }) => {
                setFormValues((prev) => ({
                  ...prev,
                  package_id,
                  custom_package_name,
                }));
              }}
            />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <input
              name="customer_name"
              type="text"
              required
              value={formValues.customer_name}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={handleNameBlur}
              placeholder="Full name*"
              className={`input bg-white ${nameError ? 'border-coral-400 focus:ring-coral-400 bg-coral-50/20' : ''}`}
              aria-invalid={Boolean(nameError)}
            />
            {nameError && (
              <p className="mt-1 text-xs text-coral-600 font-medium">{nameError}</p>
            )}
          </div>

          <div>
            <input
              name="email"
              type="email"
              required
              value={formValues.email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={handleEmailBlur}
              placeholder="Email (verified via OTP)*"
              className={`input bg-white ${emailError ? 'border-coral-400 focus:ring-coral-400 bg-coral-50/20' : ''}`}
              aria-invalid={Boolean(emailError)}
            />
            {emailError && (
              <p className="mt-1 text-xs text-coral-600 font-medium">{emailError}</p>
            )}
          </div>
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
          <DatePickerDMY
            name="travel_date"
            min={minTravelDate.iso}
            max={maxTravelDate}
            value={formValues.travel_date}
            onChange={handleDateChange}
            onClose={() => {
              setDateTouched(true);
              setDateError(validateDate(formValues.travel_date));
            }}
            invalid={Boolean(dateError)}
          />
          {dateError && (
            <p className="mt-1 text-xs text-coral-600 font-medium">{dateError}</p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">Adults (12+ yrs)</label>
            <input
              name="number_of_adults"
              type="number"
              min={1}
              value={formValues.number_of_adults}
              onChange={(e) => setFormValues((prev) => ({ ...prev, number_of_adults: Number(e.target.value) || 1 }))}
              className="input bg-white text-center"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">Children (2–11 yrs)</label>
            <input
              name="number_of_children"
              type="number"
              min={0}
              value={formValues.number_of_children}
              onChange={(e) => setFormValues((prev) => ({ ...prev, number_of_children: Number(e.target.value) || 0 }))}
              className="input bg-white text-center"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">Infants (below 2 yrs)</label>
            <input
              name="number_of_infants"
              type="number"
              min={0}
              value={formValues.number_of_infants}
              onChange={(e) => setFormValues((prev) => ({ ...prev, number_of_infants: Number(e.target.value) || 0 }))}
              className="input bg-white text-center"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">Approx. Budget per Person (₹) — Optional</label>
          <input
            name="budget"
            type="number"
            step="any"
            min={0}
            value={formValues.budget}
            onChange={(e) => setFormValues((prev) => ({ ...prev, budget: e.target.value }))}
            placeholder="e.g. 25000"
            className="input bg-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">Special Requests / Notes</label>
          <textarea
            name="message"
            rows={3}
            value={formValues.message}
            onChange={(e) => setFormValues((prev) => ({ ...prev, message: e.target.value }))}
            placeholder="Tell us a bit about your trip…"
            maxLength={2000}
            className="input bg-white resize-none"
          />
        </div>
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
