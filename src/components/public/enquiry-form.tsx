'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { submitEnquiry, type EnquirySubmitState } from '@/app/(public)/actions';
import { PhoneInput } from './phone-input';
import Link from 'next/link';
import { CheckCircle2, LogIn } from 'lucide-react';

const initialState: EnquirySubmitState = {};

function SubmitButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending || disabled}>
      {pending ? 'Sending…' : label}
    </button>
  );
}

export function EnquiryForm({
  packageId,
  destinationName,
  buttonLabel = 'Send enquiry',
  isLoggedIn,
}: {
  packageId?: string;
  destinationName?: string;
  buttonLabel?: string;
  isLoggedIn: boolean;
}) {
  const [state, formAction] = useFormState(submitEnquiry, initialState);
  const [phoneValid, setPhoneValid] = useState(false);
  const [phoneValue, setPhoneValue] = useState({ dialCode: '+91', number: '' });
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(true);
  const [whatsappValue, setWhatsappValue] = useState({ dialCode: '+91', number: '' });

  if (state.success) {
    return (
      <div className="rounded-xl2 border border-brand-200 bg-brand-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-brand-600" />
        <p className="mt-3 font-semibold text-brand-800">Thank you — we&apos;ve got your enquiry!</p>
        <p className="mt-1 text-sm text-brand-700">
          Reference number <strong>{state.enquiryNumber}</strong>. Our team will reach out shortly.
        </p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="rounded-xl2 border border-ink-100 bg-ink-50 p-6 text-center">
        <LogIn className="mx-auto h-8 w-8 text-ink-400" />
        <p className="mt-3 font-medium text-ink-800">Please log in to send a request</p>
        <p className="mt-1 text-sm text-ink-500">
          You&apos;ll need an account to submit a booking or enquiry, so you can track its status
          afterwards.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/account/login" className="btn-primary">
            Log in
          </Link>
          <Link href="/account/signup" className="btn-outline">
            Sign up
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {packageId && <input type="hidden" name="package_id" value={packageId} />}
      {destinationName && <input type="hidden" name="destination" value={destinationName} />}

      {/* A genuinely separate, visibly-bounded scroll region for the
          fields — distinct from the submit button below, which always
          stays outside it and in view. The border/background make the
          scrollable area obvious rather than relying on an invisible
          overflow that's easy to miss. */}
      <div className="max-h-[340px] space-y-3 overflow-y-auto rounded-xl2 border border-ink-100 bg-ink-50/40 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="customer_name" required placeholder="Full name*" className="input" />
          <input name="email" type="email" required placeholder="Email*" className="input" />
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
            <input type="hidden" name="whatsapp_number" value={phoneValue.number ? `${phoneValue.dialCode}${phoneValue.number}` : ''} />
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
          <label className="mb-1 block text-xs font-medium text-ink-600">When are you traveling?</label>
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="travel_date" type="date" className="input" />
          </div>
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

      {state.error && (
        <p className="rounded-lg bg-coral-50 px-3 py-2 text-sm text-coral-700">{state.error}</p>
      )}

      <SubmitButton label={buttonLabel} disabled={!phoneValid} />
      {!phoneValid && (
        <p className="text-center text-xs text-ink-400">
          Please enter a valid phone number for the selected country.
        </p>
      )}
    </form>
  );
}
