'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { submitEnquiry, type EnquirySubmitState } from '../actions';
import { CheckCircle2 } from 'lucide-react';

const initialState: EnquirySubmitState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'Sending…' : label}
    </button>
  );
}

export function EnquiryForm({
  packageId,
  destinationName,
  buttonLabel = 'Send enquiry',
}: {
  packageId?: string;
  destinationName?: string;
  buttonLabel?: string;
}) {
  const [state, formAction] = useFormState(submitEnquiry, initialState);

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

  return (
    <form action={formAction} className="space-y-3">
      {/* Honeypot — hidden from real users via CSS, bots often fill it in */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {packageId && <input type="hidden" name="package_id" value={packageId} />}
      {destinationName && <input type="hidden" name="destination" value={destinationName} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <input name="customer_name" required placeholder="Full name*" className="input" />
        <input name="phone" required placeholder="Phone number*" className="input" />
        <input name="whatsapp_number" placeholder="WhatsApp number" className="input" />
        <input name="email" type="email" placeholder="Email" className="input" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <input name="travel_date" type="date" className="input" />
        <input
          name="number_of_adults"
          type="number"
          min={1}
          defaultValue={2}
          placeholder="Adults"
          className="input"
        />
        <input
          name="number_of_children"
          type="number"
          min={0}
          defaultValue={0}
          placeholder="Children"
          className="input"
        />
      </div>
      <input name="budget" type="number" min={0} placeholder="Approximate budget (optional)" className="input" />
      <textarea
        name="message"
        rows={3}
        placeholder="Tell us a bit about your trip…"
        className="input"
      />

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <SubmitButton label={buttonLabel} />
    </form>
  );
}
