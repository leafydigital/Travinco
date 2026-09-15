'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { submitContactMessage, type ContactFormState } from './actions';
import { CheckCircle2 } from 'lucide-react';

const initialState: ContactFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'Sending…' : 'Send message'}
    </button>
  );
}

export function ContactForm() {
  const [state, formAction] = useFormState(submitContactMessage, initialState);

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

      <div className="grid gap-3 sm:grid-cols-2">
        <input name="name" required placeholder="Full name*" className="input" />
        <input name="phone" placeholder="Phone number" className="input" />
        <input name="whatsapp_number" placeholder="WhatsApp number" className="input" />
        <input name="email" type="email" placeholder="Email" className="input" />
      </div>
      <input name="subject" placeholder="Subject" className="input" />
      <textarea name="message" required rows={4} placeholder="Your message*" className="input" />

      {state.error && (
        <p className="rounded-lg bg-coral-50 px-3 py-2 text-sm text-coral-700">{state.error}</p>
      )}

      <SubmitButton />
    </form>
  );
}
