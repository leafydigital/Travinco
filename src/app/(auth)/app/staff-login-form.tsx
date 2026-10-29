'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Check,
  Circle,
  CheckCircle2,
} from 'lucide-react';
import { staffLogin, checkStaffResetEmail, sendStaffResetCode, verifyStaffResetCode } from './actions';

type Mode = 'login' | 'reset_email' | 'reset_password' | 'reset_code';

export function StaffLoginForm({
  redirectTo,
  notice,
}: {
  redirectTo?: string;
  notice?: string | null;
}) {
  const [mode, setMode] = useState<Mode>('login');

  // Sign-in
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ message: string; isLocked?: boolean } | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Forgot password
  const [resetEmail, setResetEmail] = useState('');
  const [resetName, setResetName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetTicket, setResetTicket] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [code, setCode] = useState('');

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

  function goTo(next: Mode) {
    setError(null);
    setMode(next);
  }

  function backToLogin(banner?: string) {
    setError(null);
    setSuccessBanner(banner ?? null);
    setNewPassword('');
    setConfirmPassword('');
    setCode('');
    setResetTicket('');
    setMode('login');
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    setSuccessBanner(null);
    try {
      const result = await staffLogin({ email, password, redirectTo });
      if (!result.success) {
        setError({ message: result.error || 'Unable to sign in.', isLocked: result.isLocked });
        setIsLoading(false);
        return;
      }
      // Keep "Signing in…" until the dashboard opens; the success toast is shown
      // there (admin sidebar reads this flag), not before the redirect.
      try {
        sessionStorage.setItem('tv_staff_login_success', '1');
      } catch {}
      window.location.assign(result.redirectUrl || '/travinco_dashboard');
    } catch {
      setError({ message: 'Unable to sign in right now. Please try again.' });
      setIsLoading(false);
    }
  }

  // Step 1: email -> check it is a staff account
  async function handleResetEmail(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await checkStaffResetEmail(resetEmail);
      if (!res.success) {
        setError({ message: res.error || 'No staff account found with this email address.' });
        return;
      }
      setResetName(res.fullName || '');
      goTo('reset_password');
    } catch {
      setError({ message: 'Could not check this email right now. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }

  // Step 2: new password + confirm -> email a verification code
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading || !allRulesMet || !passwordsMatch) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await sendStaffResetCode({
        email: resetEmail,
        password: newPassword,
        confirmPassword,
      });
      if (!res.success || !res.resetTicket) {
        setError({ message: res.error || 'Could not send the verification code.' });
        return;
      }
      setResetTicket(res.resetTicket);
      setMaskedEmail(res.maskedEmail || resetEmail);
      setCode('');
      goTo('reset_code');
      toast.success(`Verification code sent to ${res.maskedEmail || resetEmail}`);
    } catch {
      setError({ message: 'Could not send the verification code. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }

  // Step 3: code -> save the new password
  async function handleResetCode(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading || code.length !== 6) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await verifyStaffResetCode({ email: resetEmail, resetTicket, code });
      if (!res.success) {
        setError({ message: res.error || 'Invalid verification code.' });
        return;
      }
      toast.success('Password updated successfully');
      setEmail(resetEmail);
      setPassword('');
      backToLogin('Your password has been updated. Please sign in with your new password.');
    } catch {
      setError({ message: 'Could not update the password. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }

  const ruleItem = (ok: boolean, label: string) => (
    <li className={`flex items-center gap-1.5 ${ok ? 'text-emerald-700' : 'text-ink-400'}`}>
      {ok ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
      <span>{label}</span>
    </li>
  );

  const errorBox = error && (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${
        error.isLocked ? 'border-red-200 bg-red-50 text-red-800' : 'border-coral-200 bg-coral-50 text-coral-700'
      }`}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{error.message}</span>
    </div>
  );

  const backLink = (
    <button
      type="button"
      onClick={() => backToLogin()}
      className="mt-5 inline-flex w-full items-center justify-center gap-1.5 text-xs font-medium text-ink-500 hover:text-brand-700"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back to sign in
    </button>
  );

  return (
    <div className="w-full max-w-md rounded-2xl border border-ink-100 bg-white p-6 shadow-xl sm:p-8">
      <div className="mb-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/green_logo.png"
          alt="Travinco"
          className="mx-auto mb-4 h-14 w-auto object-contain"
        />
        <h1 className="font-display text-2xl font-bold text-ink-900">
          {mode === 'login' ? 'Team sign in' : 'Reset password'}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {mode === 'login' && 'Travinco admin & staff portal'}
          {mode === 'reset_email' && 'Enter your staff email address'}
          {mode === 'reset_password' && `Choose a new password${resetName ? ` for ${resetName}` : ''}`}
          {mode === 'reset_code' && `Enter the 6-digit code sent to ${maskedEmail}`}
        </p>
      </div>

      {mode === 'login' && (
        <>
          {notice && !successBanner && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{notice}</div>
          )}
          {successBanner && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{successBanner}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            <div>
              <label className="label" htmlFor="staff-email">
                Email
              </label>
              <div className="relative">
                <input
                  id="staff-email"
                  type="email"
                  required
                  autoComplete="username"
                  autoFocus
                  disabled={isLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@travinco.in"
                  className="input pl-10"
                />
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="label mb-0" htmlFor="staff-password">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email.trim());
                    setSuccessBanner(null);
                    goTo('reset_email');
                  }}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="staff-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10 pr-10"
                />
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {errorBox}

            <button
              type="submit"
              disabled={isLoading || !email.trim() || !password}
              className="btn-primary flex w-full items-center justify-center gap-2 py-3 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing in…</span>
                </>
              ) : (
                <span>Sign in</span>
              )}
            </button>
          </form>
        </>
      )}

      {mode === 'reset_email' && (
        <form onSubmit={handleResetEmail} className="space-y-4" noValidate>
          <div>
            <label className="label" htmlFor="reset-email">
              Staff email
            </label>
            <div className="relative">
              <input
                id="reset-email"
                type="email"
                required
                autoFocus
                disabled={isLoading}
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@travinco.in"
                className="input pl-10"
              />
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            </div>
          </div>
          {errorBox}
          <button
            type="submit"
            disabled={isLoading || !resetEmail.trim()}
            className="btn-primary flex w-full items-center justify-center gap-2 py-3 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>{isLoading ? 'Checking…' : 'Continue'}</span>
          </button>
          {backLink}
        </form>
      )}

      {mode === 'reset_password' && (
        <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
          <div>
            <label className="label" htmlFor="new-password">
              New password
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                required
                autoFocus
                autoComplete="new-password"
                disabled={isLoading}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input pl-10 pr-10"
              />
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
              {ruleItem(rules.length, 'At least 7 characters')}
              {ruleItem(rules.upper, 'One capital letter')}
              {ruleItem(rules.lower, 'One lowercase letter')}
              {ruleItem(rules.number, 'One number')}
              {ruleItem(rules.symbol, 'One symbol')}
            </ul>
          </div>
          <div>
            <label className="label" htmlFor="confirm-password">
              Confirm new password
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showNewPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                disabled={isLoading}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input pl-10"
              />
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="mt-1 text-xs text-coral-600">Passwords do not match</p>
            )}
          </div>
          {errorBox}
          <button
            type="submit"
            disabled={isLoading || !allRulesMet || !passwordsMatch}
            className="btn-primary flex w-full items-center justify-center gap-2 py-3 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>{isLoading ? 'Sending code…' : 'Save new password'}</span>
          </button>
          <p className="text-center text-[11px] text-ink-400">
            For your security we&apos;ll email a 6-digit code to confirm it&apos;s you.
          </p>
          {backLink}
        </form>
      )}

      {mode === 'reset_code' && (
        <form onSubmit={handleResetCode} className="space-y-4" noValidate>
          <div>
            <label className="label" htmlFor="reset-code">
              Verification code
            </label>
            <input
              id="reset-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              disabled={isLoading}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              className="input text-center text-2xl font-bold tracking-[0.5em]"
            />
          </div>
          {errorBox}
          <button
            type="submit"
            disabled={isLoading || code.length !== 6}
            className="btn-primary flex w-full items-center justify-center gap-2 py-3 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>{isLoading ? 'Saving…' : 'Confirm & save password'}</span>
          </button>
          <button
            type="button"
            onClick={() => goTo('reset_password')}
            className="w-full text-xs font-medium text-brand-600 hover:underline"
          >
            Didn&apos;t get the code? Send again
          </button>
          {backLink}
        </form>
      )}
    </div>
  );
}
