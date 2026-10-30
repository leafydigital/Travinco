'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AtSign, CheckCircle2, Loader2, Mail, MapPin, Pencil, Phone, ShieldCheck, User, X } from 'lucide-react';
import { toast } from '@/lib/admin-alert';
import { cn } from '@/lib/utils/cn';
import { validateEmailAddress } from '@/lib/validations/contact-rules';
import { splitPhone, joinPhone, type PhoneParts } from '@/lib/utils/phone-parts';
import { PhoneInput } from '@/components/public/phone-input';
import { ResetPasswordModal } from '@/components/admin/reset-password-modal';
import { updateOwnProfile } from './actions';

type ProfileData = {
  full_name: string;
  username: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  roleName: string;
};

function DetailRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{label}</p>
        <p className={cn('break-words text-sm', value ? 'text-ink-900' : 'text-ink-400')}>{value || 'Not set'}</p>
      </div>
    </div>
  );
}

export function ProfileView({ profile, canEdit }: { profile: ProfileData; canEdit: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState<PhoneParts>(() => splitPhone(profile.phone));
  const [phoneValid, setPhoneValid] = useState(false);
  const [address, setAddress] = useState(profile.address ?? '');
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const initials =
    profile.full_name
      ?.split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';

  function startEdit() {
    setEmail(profile.email);
    setPhone(splitPhone(profile.phone));
    setAddress(profile.address ?? '');
    setErrors({});
    setEditing(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = {
      email: validateEmailAddress(email),
      phone: !phone.number ? 'Phone number is required' : phoneValid ? null : 'Please enter a valid phone number',
    };
    setErrors(next);
    const err = Object.values(next).find(Boolean);
    if (err) return void toast.error(err);

    startTransition(async () => {
      const res = await updateOwnProfile({ email: email.trim(), phone: joinPhone(phone), address: address.trim() });
      if (res.error) return void toast.error(res.error);
      await toast.success('Profile updated', {
        description: res.emailChanged ? 'Use your new email address the next time you sign in.' : undefined,
      });
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-ink-900">{profile.full_name}</p>
          <span className="mt-0.5 inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
            <ShieldCheck className="h-3 w-3" /> {profile.roleName}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && !editing && (
            <button type="button" onClick={startEdit} className="btn-outline px-3 py-1.5 text-xs">
              <Pencil className="h-3.5 w-3.5" /> Edit profile
            </button>
          )}
          <ResetPasswordModal userEmail={profile.email} />
        </div>
      </div>

      {!editing ? (
        <div className="card divide-y divide-ink-50 px-5">
          <DetailRow icon={AtSign} label="Username" value={profile.username} />
          <DetailRow icon={Mail} label="Email" value={profile.email} />
          <DetailRow icon={Phone} label="Phone number" value={profile.phone} />
          <DetailRow icon={MapPin} label="Address" value={profile.address} />
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="card space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-700">Username</label>
              <input value={profile.username ?? ''} disabled placeholder="Not set" className="input disabled:bg-ink-50 disabled:text-ink-600" />
              <p className="mt-1 text-xs text-ink-400">Usernames are managed on the Users page.</p>
            </div>

            <div>
              <label htmlFor="profile-email" className="mb-1 block text-sm font-medium text-ink-700">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value.trim());
                  if (errors.email) setErrors((x) => ({ ...x, email: validateEmailAddress(e.target.value) }));
                }}
                onBlur={() => setErrors((x) => ({ ...x, email: validateEmailAddress(email) }))}
                className={cn('input', errors.email && 'border-red-400 focus:border-red-500')}
              />
              {errors.email ? (
                <p className="field-error">{errors.email}</p>
              ) : (
                <p className="mt-1 text-xs text-ink-400">Also your sign-in email.</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-ink-700">
                Phone number <span className="text-red-500">*</span>
              </label>
              <PhoneInput
                name="phone"
                required
                placeholder="Phone number"
                value={phone}
                onValidityChange={setPhoneValid}
                onChange={(v) => {
                  setPhone(v);
                  if (errors.phone) setErrors((x) => ({ ...x, phone: null }));
                }}
              />
              {errors.phone && <p className="field-error">{errors.phone}</p>}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="profile-address" className="mb-1 block text-sm font-medium text-ink-700">
                Address
              </label>
              <textarea
                id="profile-address"
                rows={3}
                maxLength={500}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="input resize-y"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {isPending ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
