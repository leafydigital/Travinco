'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { submitContactMessage, type ContactFormState } from './actions';
import { sendEnquiryEmailOtp, checkEnquiryEmailVerified } from '@/lib/enquiry-otp';
import { PhoneInput } from '@/components/public/phone-input';
import { CheckCircle2, ShieldCheck, Mail } from 'lucide-react';
import { toast } from 'sonner';

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
  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [phoneValid, setPhoneValid] = useState(true);
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
        <p className="mt-3 font-semibold text-brand-800">Message sent</p>
        <p className="mt-1 text-sm text-brand-700">We&apos;ll get back to you shortly.</p>
      </div>
    );
  }

  const needsVerification = email.trim().length > 0;

  return (
    <form action={formAction} className="space-y-3">
      <div className="hidden" aria-hidden="true">
        <label htmlFor="c-website">Leave this field empty</label>
        <input id="c-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <input name="name" required placeholder="Full name*" className="input" />
        <PhoneInput name="phone" placeholder="Phone number" onValidityChange={setPhoneValid} />
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
          {needsVerification && !otpVerified && (
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
            <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-brand-50 px-3 text-sm font-medium text-brand-700">
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

      <input name="subject" placeholder="Subject" className="input" />
      <textarea name="message" required rows={4} placeholder="Your message*" className="input" />

      {state.error && (
        <p className="rounded-lg bg-coral-50 px-3 py-2 text-sm text-coral-700">{state.error}</p>
      )}

      <SubmitButton disabled={(needsVerification && !otpVerified) || !phoneValid} />
      {needsVerification && !otpVerified && (
        <p className="text-center text-xs text-ink-400">
          Please verify your email above before sending your message.
        </p>
      )}
      {!phoneValid && (
        <p className="text-center text-xs text-ink-400">
          Please enter a valid phone number for the selected country, or leave it blank.
        </p>
      )}
    </form>
  );
}
