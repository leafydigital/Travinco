'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { submitEnquiry, type EnquirySubmitState } from '@/app/(public)/actions';
import { sendEnquiryEmailOtp, checkEnquiryEmailVerified } from '@/lib/enquiry-otp';
import { PhoneInput } from './phone-input';
import Link from 'next/link';
import { CheckCircle2, ShieldCheck, Mail, LogIn } from 'lucide-react';
import { toast } from 'sonner';

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
  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [phoneValid, setPhoneValid] = useState(false);
  const [isSending, startSending] = useTransition();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function handleSendLink() {
    if (!email.includes('@')) {
      toast.error('Enter a valid email first.');
      return;
    }
    startSending(async () => {
      const result = await sendEnquiryEmailOtp(email);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setLinkSent(true);
      toast.success('Verification email sent — click the link inside it.');
    });
  }

  // While waiting, quietly checks every few seconds whether the link
  // has been clicked yet, so the person doesn't have to do anything
  // else once they've clicked it in their inbox — the form just
  // unlocks on its own.
  useEffect(() => {
    if (!linkSent || otpVerified) return;
    pollRef.current = setInterval(async () => {
      const verified = await checkEnquiryEmailVerified(email);
      if (verified) {
        setOtpVerified(true);
        toast.success('Email verified.');
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [linkSent, otpVerified, email]);

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

      <div className="grid gap-3 sm:grid-cols-2">
        <input name="customer_name" required placeholder="Full name*" className="input" />
        <PhoneInput name="phone" required placeholder="Phone number*" onValidityChange={setPhoneValid} />
        <PhoneInput name="whatsapp_number" placeholder="WhatsApp number" />

        <div className="flex gap-2">
          <input
            name="email"
            type="email"
            required
            placeholder="Email*"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setLinkSent(false);
              setOtpVerified(false);
            }}
            readOnly={otpVerified}
            className="input flex-1"
          />
          {!otpVerified && (
            <button
              type="button"
              onClick={handleSendLink}
              disabled={isSending || !email.includes('@')}
              className="btn-outline shrink-0 whitespace-nowrap"
            >
              {isSending ? 'Sending…' : linkSent ? 'Resend' : 'Verify'}
            </button>
          )}
          {otpVerified && (
            <span className="flex items-center gap-1 shrink-0 whitespace-nowrap rounded-lg bg-brand-50 px-3 text-sm font-medium text-brand-700">
              <ShieldCheck className="h-4 w-4" /> Verified
            </span>
          )}
        </div>
      </div>

      {linkSent && !otpVerified && (
        <div className="flex items-start gap-2 rounded-lg bg-ink-50 p-3 text-sm text-ink-600">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <p>
            We&apos;ve sent a verification link to <strong>{email}</strong>. Open it and click the
            link — this page will update automatically once you do.
          </p>
        </div>
      )}

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

      {state.error && (
        <p className="rounded-lg bg-coral-50 px-3 py-2 text-sm text-coral-700">{state.error}</p>
      )}

      <SubmitButton label={buttonLabel} disabled={!otpVerified || !phoneValid} />
      {(!otpVerified || !phoneValid) && (
        <p className="text-center text-xs text-ink-400">
          {!phoneValid
            ? 'Please enter a valid phone number for the selected country.'
            : 'Please verify your email above before sending your enquiry.'}
        </p>
      )}
    </form>
  );
}
