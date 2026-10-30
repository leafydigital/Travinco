'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/admin-alert';
import { X, Loader2, CheckCircle2 } from 'lucide-react';
import { updateCustomerDetails, getCustomerById, checkCustomerAvailability } from './actions';
import { HField } from '@/components/admin/horizontal-field';
import { ModalPortal } from '@/components/ui/modal-portal';
import { PhoneInput, COUNTRY_PHONE_CODES } from '@/components/public/phone-input';
import { validateFullName, validateEmailAddress } from '@/lib/validations/contact-rules';

type PhoneValue = { dialCode: string; number: string; country?: string };

function splitPhone(stored?: string | null): PhoneValue {
  if (!stored) return { dialCode: '+91', number: '' };
  if (!stored.startsWith('+')) return { dialCode: '+91', number: stored.replace(/\D/g, '') };
  const sorted = [...COUNTRY_PHONE_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const c of sorted) {
    if (stored.startsWith(c.code)) return { dialCode: c.code, number: stored.slice(c.code.length).replace(/\D/g, '') };
  }
  return { dialCode: '+91', number: stored.replace(/\D/g, '') };
}

const joinPhone = (p: PhoneValue) => (p.number ? `${p.dialCode}${p.number}` : '');

interface CustomerEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  initialName?: string;
}

export function CustomerEditModal({
  isOpen,
  onClose,
  customerId,
  initialName = '',
}: CustomerEditModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);

  const [fullName, setFullName] = useState(initialName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [phone, setPhone] = useState<PhoneValue>({ dialCode: '+91', number: '' });
  const [phoneValid, setPhoneValid] = useState(false);
  const [hasWhatsapp, setHasWhatsapp] = useState(false);
  const [whatsapp, setWhatsapp] = useState<PhoneValue>({ dialCode: '+91', number: '' });
  const [whatsappValid, setWhatsappValid] = useState(true);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [source, setSource] = useState('website');
  const [notes, setNotes] = useState('');

  // Fetch full customer details on demand when edit modal opens
  useEffect(() => {
    let cancelled = false;
    if (isOpen && customerId) {
      setIsLoading(true);
      getCustomerById(customerId).then((res) => {
        if (cancelled) return;
        if (res.data) {
          setFullName(res.data.full_name || '');
          setNameError(null);
          setPhone(splitPhone(res.data.phone));
          // Show the WhatsApp field only when a different WhatsApp number is saved
          const wa = res.data.whatsapp_number || '';
          setHasWhatsapp(Boolean(wa) && wa !== res.data.phone);
          setWhatsapp(splitPhone(wa));
          setEmail(res.data.email || '');
          setEmailError(null);
          setAddress((res.data as { address?: string | null }).address || '');
          setSource(res.data.source || 'website');
          setNotes(res.data.notes || '');
        } else if (res.error) {
          toast.error(res.error);
        }
        setIsLoading(false);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [isOpen, customerId]);

  // "Already taken" checks shown under the field as the team edits (no popups)
  const phoneFull = joinPhone(phone);
  useEffect(() => {
    if (isLoading || !phoneFull || !phoneValid) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await checkCustomerAvailability({ phone: phoneFull, excludeId: customerId }).catch(() => null);
      if (!cancelled && res) setPhoneError(res.phone);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phoneFull, phoneValid, isLoading, customerId]);

  const emailTrimmed = email.trim();
  useEffect(() => {
    if (isLoading || !emailTrimmed || validateEmailAddress(emailTrimmed)) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await checkCustomerAvailability({ email: emailTrimmed, excludeId: customerId }).catch(() => null);
      if (!cancelled && res) setEmailError(res.email);
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [emailTrimmed, isLoading, customerId]);

  if (!isOpen) return null;

  function handleNameChange(raw: string) {
    // Digits are never accepted in a name
    const value = raw.replace(/\d/g, '');
    setFullName(value);
    if (value !== raw) setNameError('Numbers are not allowed in the name');
    else if (nameError) setNameError(validateFullName(value));
  }

  /** Shows every problem under its field; returns true when the form can be saved. */
  function validate(): boolean {
    const nErr = validateFullName(fullName);
    const pErr = !phone.number ? 'Phone number is required' : !phoneValid ? 'Please enter a valid phone number' : phoneError;
    const wErr = !hasWhatsapp
      ? null
      : !whatsapp.number
        ? 'Enter the WhatsApp number or untick the box'
        : !whatsappValid
          ? 'Please enter a valid WhatsApp number'
          : null;
    const eErr = email.trim() ? validateEmailAddress(email) ?? emailError : null;
    setNameError(nErr);
    setPhoneError(pErr);
    setWhatsappError(wErr);
    setEmailError(eErr);
    return !nErr && !pErr && !wErr && !eErr;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    startTransition(async () => {
      const res = await updateCustomerDetails(customerId, {
        full_name: fullName.trim(),
        phone: phoneFull,
        whatsapp_number: hasWhatsapp ? joinPhone(whatsapp) : phoneFull,
        email: email.trim() || null,
        address: address.trim() || null,
        source,
        notes: notes.trim() || null,
      });

      if (res.error) {
        // Field problems (e.g. email / phone already taken) are shown under the field
        if ('field' in res && res.field === 'email') return void setEmailError(res.error);
        if ('field' in res && res.field === 'phone') return void setPhoneError(res.error);
        if ('field' in res && res.field === 'full_name') return void setNameError(res.error);
        if ('field' in res && res.field === 'whatsapp_number') return void setWhatsappError(res.error);
        toast.error(res.error);
        return;
      }

      onClose();
      router.refresh();
      toast.success('Updated successfully');
    });
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-ink-950/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
        <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-xl border border-ink-100 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-ink-900">Edit Customer</h2>
              <p className="text-xs text-ink-500">Update complete customer details</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
  
          {/* Loading Skeleton */}
          {isLoading ? (
            <div className="p-6 space-y-4 animate-pulse">
              <div>
                <div className="h-3 w-20 rounded bg-ink-200 mb-2" />
                <div className="h-9 w-full rounded-lg bg-ink-100" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="h-3 w-16 rounded bg-ink-200 mb-2" />
                  <div className="h-9 w-full rounded-lg bg-ink-100" />
                </div>
                <div>
                  <div className="h-3 w-24 rounded bg-ink-200 mb-2" />
                  <div className="h-9 w-full rounded-lg bg-ink-100" />
                </div>
              </div>
              <div>
                <div className="h-3 w-16 rounded bg-ink-200 mb-2" />
                <div className="h-9 w-full rounded-lg bg-ink-100" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="h-3 w-12 rounded bg-ink-200 mb-2" />
                  <div className="h-9 w-full rounded-lg bg-ink-100" />
                </div>
                <div>
                  <div className="h-3 w-12 rounded bg-ink-200 mb-2" />
                  <div className="h-9 w-full rounded-lg bg-ink-100" />
                </div>
              </div>
              <div>
                <div className="h-3 w-16 rounded bg-ink-200 mb-2" />
                <div className="h-16 w-full rounded-lg bg-ink-100" />
              </div>
              <div className="flex justify-end pt-2">
                <div className="h-9 w-28 rounded-lg bg-ink-200" />
              </div>
            </div>
          ) : (
            /* Form Body */
            <form onSubmit={handleSubmit} noValidate className="p-6 space-y-3">
              <HField
                label="Full name"
                required
                htmlFor="edit-cust-name"
                labelWidth="sm:w-28"
                fieldClassName="sm:max-w-[15rem]"
                error={nameError ?? undefined}
              >
                <input
                  id="edit-cust-name"
                  type="text"
                  required
                  maxLength={120}
                  value={fullName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onBlur={() => setNameError(validateFullName(fullName))}
                  aria-invalid={Boolean(nameError)}
                  className={`input text-sm ${nameError ? 'border-red-400 focus:border-red-500' : ''}`}
                  placeholder="e.g. Rahul Sharma"
                />
              </HField>

              <HField
                label="Phone"
                required
                labelWidth="sm:w-28"
                fieldClassName="sm:max-w-[15rem]"
                error={phoneError ?? undefined}
              >
                <PhoneInput
                  compact
                  name="phone"
                  required
                  placeholder="Phone number"
                  value={phone}
                  onValidityChange={setPhoneValid}
                  onChange={(v) => {
                    setPhone(v);
                    setPhoneError(null);
                  }}
                />
              </HField>

              <HField
                label="WhatsApp"
                labelWidth="sm:w-28"
                fieldClassName="sm:max-w-[15rem]"
                error={whatsappError ?? undefined}
              >
                <label className="flex items-center gap-2 pt-2 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    checked={hasWhatsapp}
                    onChange={(e) => {
                      setHasWhatsapp(e.target.checked);
                      if (e.target.checked && !whatsapp.number) setWhatsapp({ dialCode: phone.dialCode, number: '' });
                    }}
                    className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                  />
                  Add a different WhatsApp number
                </label>
                {/* Always visible; enabled only when the box is ticked */}
                <div className="mt-2">
                  <PhoneInput
                  compact
                    name="whatsapp_number"
                    placeholder={hasWhatsapp ? 'WhatsApp number' : 'Same as phone'}
                    // While disabled it mirrors the phone number, so it's clear what WhatsApp will use
                    value={hasWhatsapp ? whatsapp : phone}
                    disabled={!hasWhatsapp}
                    onValidityChange={setWhatsappValid}
                    onChange={(v) => {
                      setWhatsapp(v);
                      setWhatsappError(null);
                    }}
                  />
                </div>
              </HField>

              <HField
                label="Email"
                htmlFor="edit-cust-email"
                labelWidth="sm:w-28"
                fieldClassName="sm:max-w-[15rem]"
                error={emailError ?? undefined}
              >
                <input
                  id="edit-cust-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value.trim());
                    setEmailError(null);
                  }}
                  onBlur={() => setEmailError(email.trim() ? validateEmailAddress(email) ?? emailError : null)}
                  aria-invalid={Boolean(emailError)}
                  className={`input text-sm ${emailError ? 'border-red-400 focus:border-red-500' : ''}`}
                  placeholder="e.g. customer@example.com"
                />
              </HField>

              <HField label="Address" htmlFor="edit-cust-address" labelWidth="sm:w-28">
                <textarea
                  id="edit-cust-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="input text-sm resize-none"
                  placeholder="House / street, area, city, state, PIN"
                />
              </HField>

              <HField label="Source" htmlFor="edit-cust-source" labelWidth="sm:w-28" fieldClassName="sm:max-w-[15rem]">
                <select
                  id="edit-cust-source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="input text-sm"
                >
                  <option value="website">Website</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="phone">Phone</option>
                  <option value="walk_in">Walk-in</option>
                  <option value="referral">Referral</option>
                  <option value="social_media">Social media</option>
                  <option value="other">Other</option>
                </select>
              </HField>
  
              <HField label="Notes" htmlFor="edit-cust-notes" labelWidth="sm:w-28">
                <textarea
                  id="edit-cust-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="input text-sm resize-none"
                  placeholder="Special preferences, past booking history, notes..."
                />
              </HField>
  
              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-ink-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isPending}
                  className="inline-flex items-center rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  data-confirm-save="true"
                  data-confirm-label="Update"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  <span>{isPending ? 'Updating...' : 'Update'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
