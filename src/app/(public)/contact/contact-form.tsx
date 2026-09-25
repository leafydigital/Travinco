'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { submitContactMessage, type ContactFormState } from './actions';
import { PhoneInput } from '@/components/public/phone-input';
import { CheckCircle2 } from 'lucide-react';

const initialState: ContactFormState = {};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending || disabled}>
      {pending ? 'Sending…' : 'Send message'}
    </button>
  );
}

export function ContactForm() {
  const [state, formAction] = useFormState(submitContactMessage, initialState);
  const [phoneValid, setPhoneValid] = useState(true);
  const [phoneValue, setPhoneValue] = useState({ dialCode: '+91', number: '' });
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(true);
  const [whatsappValue, setWhatsappValue] = useState({ dialCode: '+91', number: '' });

  if (state.success) {
    return (
      <div className="rounded-xl2 border border-brand-200 bg-brand-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-brand-600" />
        <p className="mt-3 font-semibold text-brand-800">Message sent</p>
        <p className="mt-1 text-sm text-brand-700">We&apos;ll get back to you shortly.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="hidden" aria-hidden="true">
        <label htmlFor="c-website">Leave this field empty</label>
        <input id="c-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="max-h-[340px] space-y-3 overflow-y-auto rounded-xl2 border border-ink-100 bg-ink-50/40 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="name" required placeholder="Full name*" className="input" />
          <input name="email" type="email" required placeholder="Email*" className="input" />
        </div>

        <div>
          <PhoneInput
            name="phone"
            placeholder="Phone number"
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

        <input name="subject" placeholder="Subject" className="input" />
        <textarea name="message" required rows={4} placeholder="Your message*" className="input" />
      </div>

      {state.error && (
        <p className="rounded-lg bg-coral-50 px-3 py-2 text-sm text-coral-700">{state.error}</p>
      )}

      <SubmitButton disabled={!phoneValid} />
      {!phoneValid && (
        <p className="text-center text-xs text-ink-400">
          Please enter a valid phone number for the selected country, or leave it blank.
        </p>
      )}
    </form>
  );
}
