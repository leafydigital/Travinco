'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { submitEnquiry, type EnquirySubmitState } from '@/app/(public)/actions';
import { PhoneInput } from './phone-input';
import Link from 'next/link';
import { CheckCircle2, LogIn, User, Compass, Calendar, Users, Package } from 'lucide-react';

const initialState: EnquirySubmitState = {};

function SubmitButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full py-3 text-sm font-semibold shadow-sm" disabled={pending || disabled}>
      {pending ? 'Sending…' : label}
    </button>
  );
}

export function EnquiryForm({
  packageId,
  destinationName,
  buttonLabel = 'Send enquiry',
  isLoggedIn,
  defaultName = '',
  defaultEmail = '',
  layout = 'stacked',
  availablePackages,
}: {
  packageId?: string;
  destinationName?: string;
  buttonLabel?: string;
  isLoggedIn: boolean;
  defaultName?: string;
  defaultEmail?: string;
  layout?: 'stacked' | 'split';
  availablePackages?: { id: string; title: string }[];
}) {
  const [state, formAction] = useFormState(submitEnquiry, initialState);
  const [phoneValid, setPhoneValid] = useState(false);
  const [phoneValue, setPhoneValue] = useState({ dialCode: '+91', number: '' });
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(true);
  const [whatsappValue, setWhatsappValue] = useState({ dialCode: '+91', number: '' });

  if (state.success) {
    return (
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-brand-600" />
        <p className="mt-3 font-semibold text-brand-800">Thank you — we&apos;ve got your enquiry!</p>
        <p className="mt-1 text-sm text-brand-700">
          Reference number <strong>{state.enquiryNumber}</strong>. Our team will reach out shortly with your tailored itinerary.
        </p>
        <div className="mt-4">
          <Link href="/account/bookings" className="btn-primary text-xs">
            View in My Bookings
          </Link>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="rounded-2xl border border-ink-100 bg-ink-50 p-6 text-center">
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

  // ── 1. Split 2-Column Layout (One View, No Scrollbar) ─────────────
  if (layout === 'split') {
    return (
      <form action={formAction} className="space-y-6">
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
              <label className="mb-1 block text-xs font-medium text-ink-600">Email Address *</label>
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

              {/* Package Selector Field */}
              {availablePackages && availablePackages.length > 0 && (
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-600">
                    <Package className="h-3.5 w-3.5 text-brand-600" />
                    <span>Choose Tour Package</span>
                  </label>
                  <select
                    name="package_id"
                    defaultValue={packageId || ''}
                    className="input bg-white text-ink-800 font-medium"
                  >
                    <option value="">Custom Tour / Tailored Trip (No specific package)</option>
                    {availablePackages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-600">
                  <Calendar className="h-3.5 w-3.5 text-ink-400" />
                  <span>When are you planning to travel?</span>
                </label>
                <input name="travel_date" type="date" className="input bg-white" />
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

        {/* ── Bottom Section: Actions & Submit ────────────────────── */}
        <div className="pt-2 space-y-2">
          {state.error && (
            <p className="rounded-lg bg-coral-50 px-3 py-2 text-sm text-coral-700">{state.error}</p>
          )}

          <SubmitButton label={buttonLabel} disabled={!phoneValid} />

          {!phoneValid && (
            <p className="text-center text-xs text-ink-400">
              Please enter a valid phone number for the selected country to submit.
            </p>
          )}
        </div>
      </form>
    );
  }

  // ── 2. Standard Stacked Layout (Without scrollbar) ────────────────
  return (
    <form action={formAction} className="space-y-3">
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
            <label className="mb-1 block text-xs font-medium text-ink-600">Choose Package</label>
            <select
              name="package_id"
              defaultValue={packageId || ''}
              className="input bg-white"
            >
              <option value="">Custom Tour (No specific package)</option>
              {availablePackages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.title}
                </option>
              ))}
            </select>
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
            placeholder="Email*"
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
