'use client';

import { useState, useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { submitContactMessage, type ContactFormState } from './actions';
import { PhoneInput } from '@/components/public/phone-input';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';

const initialState: ContactFormState = {};
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 3; // 3 attempts per 10 minutes
const STORAGE_KEY = 'travinco_contact_attempts_v1';

function getStoredAttempts(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    const now = Date.now();
    return Array.isArray(list) ? list.filter((t: number) => now - t < RATE_LIMIT_WINDOW_MS) : [];
  } catch {
    return [];
  }
}

function recordStoredAttempt() {
  if (typeof window === 'undefined') return;
  try {
    const now = Date.now();
    const attempts = getStoredAttempts();
    attempts.push(now);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
  } catch {
    // Ignore storage issues
  }
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn-primary w-full shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      disabled={pending || disabled}
    >
      {pending ? 'Sending…' : 'Send message'}
    </button>
  );
}

export function ContactForm() {
  const [state, formAction] = useFormState(submitContactMessage, initialState);

  // Field values
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneValue, setPhoneValue] = useState({ dialCode: '+91', number: '' });
  const [phoneValid, setPhoneValid] = useState(true);
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(true);
  const [whatsappValue, setWhatsappValue] = useState({ dialCode: '+91', number: '' });
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // Touched state
  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  // Error messages
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Client-side rate limit state (3 attempts per 10 minutes)
  const [clientRateLimited, setClientRateLimited] = useState(false);
  const [rateLimitSecondsRemaining, setRateLimitSecondsRemaining] = useState(0);

  // Check rate limit on mount and on storage change
  useEffect(() => {
    function checkRate() {
      const attempts = getStoredAttempts();
      const now = Date.now();
      if (attempts.length >= RATE_LIMIT_MAX) {
        const oldest = attempts[0] || (now - RATE_LIMIT_WINDOW_MS);
        const diffMs = Math.max(0, RATE_LIMIT_WINDOW_MS - (now - oldest));
        const secondsLeft = Math.ceil(diffMs / 1000);
        if (secondsLeft > 0) {
          setClientRateLimited(true);
          setRateLimitSecondsRemaining(secondsLeft);
          return;
        }
      }
      setClientRateLimited(false);
      setRateLimitSecondsRemaining(0);
    }

    checkRate();
    const interval = setInterval(checkRate, 1000);
    return () => clearInterval(interval);
  }, []);

  // Record attempt in localStorage when submission succeeds
  useEffect(() => {
    if (state.success) {
      recordStoredAttempt();
    }
  }, [state.success]);

  // Validation functions
  function validateName(val: string): string | null {
    const trimmed = val.trim();
    if (!trimmed) {
      return 'Enter valid full name';
    }
    if (/\d/.test(val)) {
      return 'Enter valid full name';
    }
    if (!/^[a-zA-Z\s'.\-]+$/.test(trimmed)) {
      return 'Enter valid full name';
    }
    return null;
  }

  function handleNameChange(val: string) {
    setName(val);
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
    setNameError(validateName(name));
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
    setEmail(val);
    if (emailTouched) {
      setEmailError(validateEmail(val));
    } else {
      setEmailError(null);
    }
  }

  function handleEmailBlur() {
    setEmailTouched(true);
    setEmailError(validateEmail(email));
  }

  // Field validity checks
  const isNameValid = Boolean(name.trim()) && !/\d/.test(name) && /^[a-zA-Z\s'.\-]+$/.test(name.trim());
  const isEmailValid = Boolean(email.trim()) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isSubjectValid = Boolean(subject.trim());
  const isMessageValid = Boolean(message.trim());
  const isPhoneValid = phoneValid;

  // Form is complete and button enables only when all required fields are valid
  const isFormValid =
    isNameValid &&
    isEmailValid &&
    isSubjectValid &&
    isMessageValid &&
    isPhoneValid &&
    !clientRateLimited;

  if (state.success) {
    return (
      <div className="rounded-2xl border border-brand-200 bg-brand-50/80 p-8 text-center animate-in fade-in duration-300">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <p className="mt-4 font-display text-xl font-bold text-brand-900">Message sent successfully</p>
        <p className="mt-1.5 text-sm text-brand-700 leading-relaxed max-w-sm mx-auto">
          Thank you for reaching out! Our destination specialists will review your message and get back to you shortly.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {/* Honeypot */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="c-website">Leave this field empty</label>
        <input id="c-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {/* Rate limit warning banner */}
      {clientRateLimited && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-800 flex items-start gap-2.5">
          <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900">Rate Limit Active</p>
            <p className="mt-0.5 leading-relaxed">
              You can send up to 3 messages every 10 minutes. Please wait{' '}
              <strong className="font-bold">
                {Math.floor(rateLimitSecondsRemaining / 60)}m {rateLimitSecondsRemaining % 60}s
              </strong>{' '}
              before submitting another message.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3.5 rounded-2xl border border-ink-150/70 bg-ink-50/40 p-4 sm:p-5">
        {/* Full Name & Email */}
        <div className="grid gap-3.5 sm:grid-cols-2">
          {/* Full Name */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">
              Full name <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={handleNameBlur}
              placeholder="Full name*"
              className={`input bg-white text-sm ${
                nameError ? 'border-coral-400 focus:ring-coral-400 bg-coral-50/20' : ''
              }`}
              aria-invalid={Boolean(nameError)}
            />
            {nameError && (
              <p className="mt-1 text-xs text-coral-600 font-medium flex items-center gap-1 animate-in fade-in duration-150">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>{nameError}</span>
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">
              Email address <span className="text-red-500">*</span>
            </label>
            <input
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={handleEmailBlur}
              placeholder="Email*"
              className={`input bg-white text-sm ${
                emailError ? 'border-coral-400 focus:ring-coral-400 bg-coral-50/20' : ''
              }`}
              aria-invalid={Boolean(emailError)}
            />
            {emailError && (
              <p className="mt-1 text-xs text-coral-600 font-medium flex items-center gap-1 animate-in fade-in duration-150">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>{emailError}</span>
              </p>
            )}
          </div>
        </div>

        {/* Phone Input */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink-700">Phone number</label>
          <PhoneInput
            name="phone"
            placeholder="Phone number"
            onValidityChange={setPhoneValid}
            value={phoneValue}
            onChange={setPhoneValue}
          />
        </div>

        {/* WhatsApp Same Number Toggle */}
        <div>
          <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-ink-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={whatsappSameAsPhone}
              onChange={(e) => setWhatsappSameAsPhone(e.target.checked)}
              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
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
            <div className="mt-2">
              <label className="mb-1 block text-xs font-semibold text-ink-700">WhatsApp number</label>
              <PhoneInput
                name="whatsapp_number"
                placeholder="WhatsApp number"
                value={whatsappValue}
                onChange={setWhatsappValue}
              />
            </div>
          )}
        </div>

        {/* Subject (Required - No error message) */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink-700">
            Subject <span className="text-red-500">*</span>
          </label>
          <input
            name="subject"
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject*"
            className="input bg-white text-sm"
          />
        </div>

        {/* Message (Required - No error message) */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink-700">
            Your message <span className="text-red-500">*</span>
          </label>
          <textarea
            name="message"
            required
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Your message*"
            className="input bg-white text-sm"
          />
        </div>
      </div>

      {/* Server error message if any */}
      {state.error && (
        <div className="rounded-xl border border-coral-200 bg-coral-50 p-3.5 text-xs text-coral-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-coral-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{state.error}</p>
        </div>
      )}

      {/* Submit Button */}
      <SubmitButton disabled={!isFormValid} />

      {/* Helper text when button is disabled */}
      {!isFormValid && !clientRateLimited && (
        <p className="text-center text-xs text-ink-400">
          Please complete all required fields (*), ensure full name has no numbers, and provide a valid email to enable sending.
        </p>
      )}
    </form>
  );
}
