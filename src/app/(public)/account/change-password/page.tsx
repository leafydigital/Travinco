'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Check,
  Circle,
  ArrowLeft,
  Mail,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { verifyCustomerEmailAction, changeCustomerPassword } from '../actions';

export default function ChangePasswordPage() {
  const router = useRouter();

  // Multi-step flow state
  const [step, setStep] = useState<'verify_email' | 'new_password'>('verify_email');
  const [email, setEmail] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [verifiedName, setVerifiedName] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Password fields
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Live validation rules
  const rules = useMemo(
    () => ({
      length: password.length >= 7,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      symbol: /[^A-Za-z0-9]/.test(password),
      matches: password.length > 0 && password === confirmPassword,
    }),
    [password, confirmPassword]
  );

  const allRulesMet =
    rules.length &&
    rules.upper &&
    rules.lower &&
    rules.number &&
    rules.symbol &&
    rules.matches;

  // Step 1: Verify email
  async function handleVerifyEmail(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || isVerifying) return;

    setIsVerifying(true);
    setVerifyError(null);

    try {
      const res = await verifyCustomerEmailAction(cleanEmail);

      // Only show toast when API response is available
      if (res.error) {
        setIsVerifying(false);
        setVerifyError(res.error);
        toast.error(res.error);
        return;
      }

      setVerifiedEmail(res.email || cleanEmail);
      setVerifiedName(res.fullName || 'Customer');
      setStep('new_password');
      setIsVerifying(false);
      toast.success('Email confirmed. Please enter your new password.');
    } catch (err: any) {
      setIsVerifying(false);
      const msg = err?.message || 'Could not verify email. Please try again.';
      setVerifyError(msg);
      toast.error(msg);
    }
  }

  // Step 2: Save new password
  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!allRulesMet || isUpdating) return;

    setIsUpdating(true);
    setUpdateError(null);

    try {
      const res = await changeCustomerPassword({
        email: verifiedEmail,
        password,
        confirmPassword,
      });

      // Only show toast when API response is available
      if (res.error) {
        setIsUpdating(false);
        setUpdateError(res.error);
        toast.error(res.error);
        return;
      }

      setIsUpdating(false);
      setIsSuccess(true);
      toast.success('Password updated successfully!');

      // Redirect back to bookings / account
      setTimeout(() => {
        router.push('/account/bookings');
      }, 1500);
    } catch (err: any) {
      setIsUpdating(false);
      const msg = err?.message || 'Failed to update password. Please try again.';
      setUpdateError(msg);
      toast.error(msg);
    }
  }

  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center pt-32 pb-12">
      <div className="w-full max-w-md">
        <Link
          href="/account"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-brand-700 transition"
        >
          <ArrowLeft className="h-4 w-4" /> Back to account
        </Link>

        {isSuccess ? (
          <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h1 className="font-display text-2xl font-semibold text-ink-900">Password Updated!</h1>
            <p className="text-sm text-ink-500">
              Your password has been changed successfully. Redirecting you to your bookings…
            </p>
            <div className="pt-2">
              <Link href="/account/bookings" className="btn-primary inline-flex items-center gap-2">
                Go to My Bookings
              </Link>
            </div>
          </div>
        ) : step === 'verify_email' ? (
          /* ── STEP 1: Enter & Confirm Email ── */
          <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-display text-xl font-semibold text-ink-900">Change Password</h1>
                <p className="text-xs text-ink-500">Step 1 of 2: Confirm your email</p>
              </div>
            </div>

            <p className="text-sm text-ink-600">
              For security, please enter your registered customer account email. Once confirmed, you can set your new password.
            </p>

            <form onSubmit={handleVerifyEmail} className="space-y-4">
              <div>
                <label className="label">Registered Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    disabled={isVerifying}
                    placeholder="you@gmail.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (verifyError) setVerifyError(null);
                    }}
                    className="input pl-10"
                    autoFocus
                  />
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                </div>
              </div>

              {verifyError && (
                <div className="flex items-center gap-2 rounded-lg border border-coral-200 bg-coral-50 p-2.5 text-xs text-coral-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-coral-600" />
                  <span>{verifyError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifying || !email.trim()}
                className="btn-primary w-full flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Confirming email…</span>
                  </>
                ) : (
                  <span>Confirm Email &amp; Continue</span>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* ── STEP 2: Enter New Password ── */
          <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-display text-xl font-semibold text-ink-900">Change Password</h1>
                <p className="text-xs text-ink-500">Step 2 of 2: Set your new password</p>
              </div>
            </div>

            {/* Confirmed account banner */}
            <div className="flex items-center justify-between rounded-xl bg-emerald-50/90 border border-emerald-200 p-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-emerald-950">
                    {verifiedName}
                  </p>
                  <p className="truncate text-[11px] text-emerald-700 font-medium">
                    {verifiedEmail} · Verified
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep('verify_email');
                  setUpdateError(null);
                }}
                className="text-xs font-semibold text-emerald-800 hover:underline shrink-0 ml-2 cursor-pointer"
              >
                Change
              </button>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="label">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={isUpdating}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="input pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ink-400 hover:text-ink-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    disabled={isUpdating}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ink-400 hover:text-ink-600 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Live Requirements Checklist */}
              <div className="rounded-xl bg-ink-50/80 border border-ink-100 p-3 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 mb-1">
                  Password Requirements:
                </p>
                <div className="grid grid-cols-2 gap-1 text-[11px]">
                  <div className={`flex items-center gap-1.5 ${rules.length ? 'text-emerald-700 font-medium' : 'text-ink-400'}`}>
                    {rules.length ? <Check className="h-3 w-3 text-emerald-600 shrink-0" /> : <Circle className="h-3 w-3 text-ink-300 shrink-0" />}
                    <span>7+ characters</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${rules.upper ? 'text-emerald-700 font-medium' : 'text-ink-400'}`}>
                    {rules.upper ? <Check className="h-3 w-3 text-emerald-600 shrink-0" /> : <Circle className="h-3 w-3 text-ink-300 shrink-0" />}
                    <span>Uppercase (A-Z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${rules.lower ? 'text-emerald-700 font-medium' : 'text-ink-400'}`}>
                    {rules.lower ? <Check className="h-3 w-3 text-emerald-600 shrink-0" /> : <Circle className="h-3 w-3 text-ink-300 shrink-0" />}
                    <span>Lowercase (a-z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${rules.number ? 'text-emerald-700 font-medium' : 'text-ink-400'}`}>
                    {rules.number ? <Check className="h-3 w-3 text-emerald-600 shrink-0" /> : <Circle className="h-3 w-3 text-ink-300 shrink-0" />}
                    <span>Number (0-9)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${rules.symbol ? 'text-emerald-700 font-medium' : 'text-ink-400'}`}>
                    {rules.symbol ? <Check className="h-3 w-3 text-emerald-600 shrink-0" /> : <Circle className="h-3 w-3 text-ink-300 shrink-0" />}
                    <span>Symbol (!@#$%)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${rules.matches ? 'text-emerald-700 font-medium' : 'text-ink-400'}`}>
                    {rules.matches ? <Check className="h-3 w-3 text-emerald-600 shrink-0" /> : <Circle className="h-3 w-3 text-ink-300 shrink-0" />}
                    <span>Passwords match</span>
                  </div>
                </div>
              </div>

              {updateError && (
                <div className="flex items-center gap-2 rounded-lg border border-coral-200 bg-coral-50 p-2.5 text-xs text-coral-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-coral-600" />
                  <span>{updateError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!allRulesMet || isUpdating}
                className="btn-primary w-full flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Updating password…</span>
                  </>
                ) : (
                  <span>Update Password</span>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
