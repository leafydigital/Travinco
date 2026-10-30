'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Check,
  Circle,
  RefreshCw,
} from 'lucide-react';
import {
  startCustomerPasswordUpdate,
  resendCustomerPasswordUpdateOtp,
  confirmCustomerPasswordUpdate,
} from '../actions';

type Step = 'passwords' | 'otp' | 'done';
type Field = 'currentPassword' | 'newPassword' | 'confirmPassword';

function PasswordInput({
  id,
  label,
  value,
  onChange,
  show,
  onToggle,
  disabled,
  autoComplete,
  autoFocus,
  invalid,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  disabled?: boolean;
  autoComplete: string;
  autoFocus?: boolean;
  invalid?: boolean;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          required
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          placeholder="••••••••"
          aria-invalid={invalid || undefined}
          className={`input pl-10 pr-10 ${invalid ? 'border-coral-400 focus:border-coral-500 focus:ring-coral-500' : ''}`}
        />
        <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-ink-400 hover:text-ink-600"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('passwords');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [resetTicket, setResetTicket] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const [isBusy, setIsBusy] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<{ message: string; field?: Field } | null>(null);

  const rules = useMemo(
    () => ({
      length: newPassword.length >= 7,
      upper: /[A-Z]/.test(newPassword),
      lower: /[a-z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      symbol: /[^A-Za-z0-9]/.test(newPassword),
    }),
    [newPassword]
  );
  const allRulesMet = Object.values(rules).every(Boolean);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(c - 1, 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    if (step !== 'done') return;
    const t = setTimeout(() => router.push('/account/bookings'), 2500);
    return () => clearTimeout(t);
  }, [step, router]);

  // Step 1: current + new + confirm -> current password verified -> code emailed
  async function handleSubmitPasswords(e: React.FormEvent) {
    e.preventDefault();
    if (isBusy || !currentPassword || !allRulesMet || !passwordsMatch) return;
    setIsBusy(true);
    setError(null);
    try {
      const res = await startCustomerPasswordUpdate({ currentPassword, newPassword, confirmPassword });
      if (!res.success || !res.resetTicket) {
        setError({ message: res.error || 'Could not continue. Please try again.', field: res.field });
        return;
      }
      setResetTicket(res.resetTicket);
      setMaskedEmail(res.maskedEmail || 'your email');
      setCode('');
      setCooldown(60);
      setStep('otp');
      toast.success(`Verification code sent to ${res.maskedEmail || 'your email'}`);
    } catch {
      setError({ message: 'Could not continue. Please try again.' });
    } finally {
      setIsBusy(false);
    }
  }

  // Step 2: code -> password saved
  async function handleConfirmCode(e: React.FormEvent) {
    e.preventDefault();
    if (isBusy || code.length !== 6) return;
    setIsBusy(true);
    setError(null);
    try {
      const res = await confirmCustomerPasswordUpdate(resetTicket, code);
      if (!res.success) {
        setError({ message: res.error || 'Invalid verification code.' });
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setResetTicket('');
      setStep('done');
      toast.success('Password updated successfully');
    } catch {
      setError({ message: 'Could not update your password. Please try again.' });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || isResending || !resetTicket) return;
    setIsResending(true);
    setError(null);
    try {
      const res = await resendCustomerPasswordUpdateOtp(resetTicket);
      if (!res.success || !res.resetTicket) {
        setError({ message: res.error || 'Could not resend the code.' });
        return;
      }
      setResetTicket(res.resetTicket);
      setCode('');
      setCooldown(60);
      toast.success('A new verification code has been sent.');
    } catch {
      setError({ message: 'Could not resend the code. Please try again.' });
    } finally {
      setIsResending(false);
    }
  }

  const ruleItem = (ok: boolean, label: string) => (
    <li className={`flex items-center gap-1.5 ${ok ? 'text-emerald-700 font-medium' : 'text-ink-400'}`}>
      {ok ? <Check className="h-3 w-3" /> : <Circle className="h-2.5 w-2.5" />}
      {label}
    </li>
  );

  const errorBox = error && (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-coral-200 bg-coral-50 p-2.5 text-xs text-coral-800">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-coral-600" />
      <span>{error.message}</span>
    </div>
  );

  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center pt-32 pb-12">
      <div className="w-full max-w-md">
        <Link
          href="/account"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 transition hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to account
        </Link>

        {step === 'done' ? (
          <div className="space-y-4 rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h1 className="font-display text-2xl font-semibold text-ink-900">Password Updated!</h1>
            <p className="text-sm text-ink-500">
              Your password has been updated successfully. Redirecting you to your bookings…
            </p>
            <div className="pt-2">
              <Link href="/account/bookings" className="btn-primary inline-flex items-center gap-2">
                Go to My Bookings
              </Link>
            </div>
          </div>
        ) : step === 'passwords' ? (
          <div className="space-y-5 rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-display text-xl font-semibold text-ink-900">Update Password</h1>
                <p className="text-xs text-ink-500">Step 1 of 2: Enter your passwords</p>
              </div>
            </div>

            <form onSubmit={handleSubmitPasswords} className="space-y-4" noValidate>
              <PasswordInput
                id="current-password"
                label="Current Password"
                value={currentPassword}
                onChange={(v) => {
                  setCurrentPassword(v);
                  if (error?.field === 'currentPassword') setError(null);
                }}
                show={showCurrent}
                onToggle={() => setShowCurrent((v) => !v)}
                disabled={isBusy}
                autoComplete="current-password"
                autoFocus
                invalid={error?.field === 'currentPassword'}
              />

              <div>
                <PasswordInput
                  id="new-password"
                  label="New Password"
                  value={newPassword}
                  onChange={setNewPassword}
                  show={showNew}
                  onToggle={() => setShowNew((v) => !v)}
                  disabled={isBusy}
                  autoComplete="new-password"
                  invalid={error?.field === 'newPassword'}
                />
                <ul className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
                  {ruleItem(rules.length, '7+ characters')}
                  {ruleItem(rules.upper, '1 capital letter')}
                  {ruleItem(rules.lower, '1 lowercase letter')}
                  {ruleItem(rules.number, '1 number')}
                  {ruleItem(rules.symbol, '1 symbol (e.g. !@#)')}
                </ul>
              </div>

              <div>
                <PasswordInput
                  id="confirm-password"
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  show={showNew}
                  onToggle={() => setShowNew((v) => !v)}
                  disabled={isBusy}
                  autoComplete="new-password"
                  invalid={confirmPassword.length > 0 && !passwordsMatch}
                />
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="mt-1 text-xs text-coral-600">Passwords do not match.</p>
                )}
                {confirmPassword.length > 0 && passwordsMatch && (
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-600">
                    <Check className="h-3 w-3" /> Passwords match
                  </p>
                )}
              </div>

              {errorBox}

              <button
                type="submit"
                disabled={isBusy || !currentPassword || !allRulesMet || !passwordsMatch}
                className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-60"
              >
                {isBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verifying current password…</span>
                  </>
                ) : (
                  <span>Continue</span>
                )}
              </button>
              <p className="text-center text-[11px] text-ink-400">
                After we verify your current password, we&apos;ll email a 6-digit code to your account email to confirm the change.
              </p>
            </form>
          </div>
        ) : (
          <div className="space-y-5 rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-display text-xl font-semibold text-ink-900">Update Password</h1>
                <p className="text-xs text-ink-500">Step 2 of 2: Verify it&apos;s you</p>
              </div>
            </div>

            <p className="text-sm text-ink-600">
              Your current password is verified. Enter the 6-digit code we sent to{' '}
              <strong className="font-semibold text-ink-900">{maskedEmail}</strong> to save your new password.
            </p>

            <form onSubmit={handleConfirmCode} className="space-y-4" noValidate>
              <div>
                <label className="label" htmlFor="update-code">
                  Verification code
                </label>
                <input
                  id="update-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  disabled={isBusy}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  className="input text-center text-2xl font-bold tracking-[0.5em]"
                />
              </div>

              {errorBox}

              <button
                type="submit"
                disabled={isBusy || code.length !== 6}
                className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-60"
              >
                {isBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving…</span>
                  </>
                ) : (
                  <span>Verify &amp; Update Password</span>
                )}
              </button>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep('passwords');
                  }}
                  className="font-medium text-ink-600 hover:text-ink-900 hover:underline"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || isResending}
                  className={`inline-flex items-center gap-1 font-semibold ${
                    cooldown > 0 ? 'cursor-not-allowed text-ink-400' : 'text-emerald-700 hover:underline'
                  }`}
                >
                  <RefreshCw className={`h-3 w-3 ${isResending ? 'animate-spin' : ''}`} />
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
