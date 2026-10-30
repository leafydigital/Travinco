'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { parsePhoneNumberFromString } from 'libphonenumber-js/mobile';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Pencil,
  Loader2,
  AlertCircle,
  X,
  Save,
  CalendarDays,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { PhoneInput } from '@/components/public/phone-input';
import { formatDate } from '@/lib/utils/format';
import { updateCustomerProfile, type CustomerProfile } from '../actions';

type PhoneValue = { dialCode: string; number: string; country?: string };

function splitPhone(e164: string): PhoneValue {
  const parsed = e164 ? parsePhoneNumberFromString(e164) : undefined;
  if (parsed) {
    return { dialCode: `+${parsed.countryCallingCode}`, number: parsed.nationalNumber, country: parsed.country };
  }
  return { dialCode: '+91', number: e164.replace(/\D/g, '') };
}

function displayPhone(e164: string): string {
  if (!e164) return '';
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}

function initials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0];
  const last = parts.length >= 2 ? parts[parts.length - 1]?.[0] : undefined;
  if (first && last) return (first + last).toUpperCase();
  return (parts[0]?.[0] || email[0] || '?').toUpperCase();
}

/** One labelled field: read-only value, or its input while editing. */
function Field({
  icon: Icon,
  label,
  value,
  required,
  locked,
  hint,
  wide,
  children,
  editing,
}: {
  icon: typeof User;
  label: string;
  value: string;
  required?: boolean;
  locked?: boolean;
  hint?: string;
  wide?: boolean;
  editing: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
        {editing && required && <span className="text-coral-500">*</span>}
        {locked && <Lock className="ml-auto h-3 w-3 text-ink-300" aria-label="Cannot be changed" />}
      </div>
      {editing && children ? (
        children
      ) : (
        <div
          className={`min-h-[44px] whitespace-pre-line break-words rounded-xl border px-3.5 py-2.5 text-sm ${
            locked ? 'border-ink-100 bg-sand-50/60' : 'border-transparent bg-sand-50/40'
          } ${value ? 'text-ink-900' : 'italic text-ink-400'}`}
        >
          {value || 'Not added yet'}
        </div>
      )}
      {hint && <p className="mt-1 text-[11px] text-ink-400">{hint}</p>}
    </div>
  );
}

export function ProfileForm({ initial }: { initial: CustomerProfile }) {
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);

  const [fullName, setFullName] = useState(initial.full_name);
  const [phone, setPhone] = useState<PhoneValue>(() => splitPhone(initial.phone));
  const [phoneValid, setPhoneValid] = useState(true);
  const [address, setAddress] = useState(initial.address);

  const completion = useMemo(() => {
    const items = [
      { label: 'Full name', done: Boolean(profile.full_name) },
      { label: 'Mobile number', done: Boolean(profile.phone) },
      { label: 'Email', done: Boolean(profile.email) },
      { label: 'Address', done: Boolean(profile.address) },
    ];
    const done = items.filter((i) => i.done).length;
    return { items, percent: Math.round((done / items.length) * 100) };
  }, [profile]);

  function startEditing() {
    setFullName(profile.full_name);
    setPhone(splitPhone(profile.phone));
    setAddress(profile.address);
    setError(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await updateCustomerProfile({
        full_name: fullName,
        phone: phone.number ? `${phone.dialCode}${phone.number}` : '',
        address,
      });
      if (!res.success || !res.profile) {
        setError({ message: res.error || 'Could not save your profile.', field: res.field });
        return;
      }
      setProfile(res.profile);
      setIsEditing(false);
      toast.success('Profile updated successfully');
      router.refresh();
    } catch {
      setError({ message: 'Could not save your profile. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* ── Identity card ─────────────────────────────────────────────── */}
      <aside className="space-y-6 lg:col-span-4">
        <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-sm">
          <div className="h-20 bg-gradient-to-r from-brand-700 via-brand-600 to-emerald-500" />
          <div className="-mt-10 px-6 pb-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-brand-50 font-display text-2xl font-bold text-brand-700 shadow-md">
              {initials(profile.full_name, profile.email)}
            </div>
            <h2 className="mt-3 break-words font-display text-lg font-bold text-ink-900">
              {profile.full_name || 'Traveller'}
            </h2>
            <p className="break-all text-sm text-ink-500">{profile.email}</p>
            {profile.member_since && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-sand-50 px-3 py-1 text-xs text-ink-500">
                <CalendarDays className="h-3.5 w-3.5" /> Member since {formatDate(profile.member_since)}
              </p>
            )}

            {/* Profile completeness */}
            <div className="mt-5 rounded-xl border border-ink-100 bg-sand-50/50 p-4 text-left">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink-700">Profile completeness</span>
                <span className="font-bold text-brand-700">{completion.percent}%</span>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100"
                role="progressbar"
                aria-valuenow={completion.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Profile completeness"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-600 to-emerald-500 transition-all duration-500"
                  style={{ width: `${completion.percent}%` }}
                />
              </div>
              {completion.percent < 100 && (
                <p className="mt-2 text-[11px] text-ink-500">
                  Add your{' '}
                  {completion.items
                    .filter((i) => !i.done)
                    .map((i) => i.label.toLowerCase())
                    .join(' and ')}{' '}
                  so we can reach you faster.
                </p>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ── Details card ──────────────────────────────────────────────── */}
      <section className="lg:col-span-8">
        <form
          onSubmit={handleSave}
          noValidate
          className={`rounded-2xl border bg-white shadow-sm transition ${
            isEditing ? 'border-brand-200 ring-4 ring-brand-50' : 'border-ink-200/80'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-6 py-5 sm:px-8">
            <div>
              <h2 className="font-display text-lg font-bold text-ink-900">Personal Details</h2>
              <p className="text-xs text-ink-500">
                {isEditing ? 'Update your details and press Save.' : 'Your name, contact number and address.'}
              </p>
            </div>
            {!isEditing ? (
              <button type="button" onClick={startEditing} className="btn-outline inline-flex items-center gap-1.5">
                <Pencil className="h-4 w-4" /> Edit
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                <Pencil className="h-3 w-3" /> Editing
              </span>
            )}
          </div>

          <div className="grid gap-5 px-6 py-6 sm:grid-cols-2 sm:px-8">
            <Field icon={User} label="Full Name" value={profile.full_name} required editing={isEditing}>
              <input
                id="profile-name"
                type="text"
                required
                maxLength={120}
                disabled={isSaving}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={`input ${error?.field === 'full_name' ? 'border-coral-400' : ''}`}
                autoComplete="name"
                autoFocus
                aria-label="Full name"
              />
            </Field>

            <Field icon={Phone} label="Mobile Number" value={displayPhone(profile.phone)} required editing={isEditing}>
              <PhoneInput
                name="phone"
                required
                disabled={isSaving}
                placeholder="Mobile number"
                value={phone}
                onChange={setPhone}
                onValidityChange={setPhoneValid}
              />
            </Field>

            <Field
              icon={Mail}
              label="Email"
              value={profile.email}
              locked
              wide
              editing={false}
              hint={isEditing ? 'Your email is your sign-in ID and can’t be changed here.' : undefined}
            />

            <Field icon={MapPin} label="Address" value={profile.address} wide editing={isEditing}>
              <textarea
                id="profile-address"
                rows={3}
                maxLength={500}
                disabled={isSaving}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House / street, city, state, PIN code"
                className={`input resize-y ${error?.field === 'address' ? 'border-coral-400' : ''}`}
                autoComplete="street-address"
                aria-label="Address"
              />
              <p className="mt-1 text-right text-[11px] text-ink-400">{address.length}/500</p>
            </Field>
          </div>

          {isEditing && (
            <div className="space-y-4 border-t border-ink-100 px-6 py-5 sm:px-8">
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-coral-200 bg-coral-50 p-2.5 text-xs text-coral-800"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-coral-600" />
                  <span>{error.message}</span>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={isSaving}
                  className="btn-outline inline-flex items-center gap-1.5"
                >
                  <X className="h-4 w-4" /> Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !fullName.trim() || !phone.number || !phoneValid}
                  className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </form>

        {!isEditing && completion.percent === 100 && (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Your profile is complete.
          </p>
        )}
      </section>
    </div>
  );
}
