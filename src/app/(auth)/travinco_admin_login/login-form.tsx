'use client';

import { useState, useTransition, useMemo } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import {
  login,
  checkStaffEmailAction,
  resetStaffPasswordDirectAction,
  type LoginState,
} from './actions';
import {
  Eye,
  EyeOff,
  KeyRound,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Check,
  Circle,
} from 'lucide-react';
import { toast } from 'sonner';

const initialState: LoginState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full cursor-pointer" disabled={pending}>
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  );
}

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction] = useFormState(login, initialState);
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Reset password states
  const [resetStep, setResetStep] = useState<'verify' | 'new_password'>('verify');
  const [resetEmail, setResetEmail] = useState('');
  const [verifiedName, setVerifiedName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Password rules validation
  const rules = useMemo(
    () => ({
      length: newPassword.length >= 7,
      upper: /[A-Z]/.test(newPassword),
      lower: /[a-z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      symbol: /[^A-Za-z0-9]/.test(newPassword),
      matches: newPassword.length > 0 && newPassword === confirmPassword,
    }),
    [newPassword, confirmPassword]
  );

  const allRulesMet =
    rules.length &&
    rules.upper &&
    rules.lower &&
    rules.number &&
    rules.symbol &&
    rules.matches;

  // Step 1: Verify staff email in DB
  const handleVerifyEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim() || isPending) return;

    setResetError(null);
    startTransition(async () => {
      const res = await checkStaffEmailAction(resetEmail);
      if (!res.success) {
        setResetError(res.error || 'No active staff account found with this email address.');
      } else {
        setVerifiedName(res.fullName || 'Staff Member');
        setResetStep('new_password');
        setResetError(null);
      }
    });
  };

  // Step 2: Set and save new password directly in DB
  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRulesMet || isPending) return;

    setResetError(null);
    startTransition(async () => {
      const res = await resetStaffPasswordDirectAction({
        email: resetEmail,
        password: newPassword,
        confirmPassword,
      });

      if (res?.error) {
        setResetError(res.error);
        toast.error(res.error);
      } else {
        toast.success('Password updated successfully!');
        setSuccessBanner('Your password has been updated in the database. Please sign in with your new password.');
        setEmail(resetEmail);
        setMode('login');
        setResetStep('verify');
        setNewPassword('');
        setConfirmPassword('');
        setResetError(null);
      }
    });
  };

  if (mode === 'reset') {
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        {/* Step 1: Verify Email in DB */}
        {resetStep === 'verify' && (
          <form onSubmit={handleVerifyEmail} className="space-y-4">
            <div className="flex items-center gap-2 text-ink-800">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-ink-900">Reset Password</h2>
                <p className="text-xs text-ink-500">
                  Enter your staff email to verify your account in the database.
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="reset-email" className="label">
                Staff Email Address
              </label>
              <input
                id="reset-email"
                type="email"
                required
                autoComplete="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="input"
                placeholder="you@agency.com"
                disabled={isPending}
                autoFocus
              />
            </div>

            {resetError && (
              <div className="flex items-center gap-2 rounded-lg border border-coral-200 bg-coral-50 p-2.5 text-xs text-coral-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-coral-600" />
                <span>{resetError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending || !resetEmail.trim()}
              className="btn-primary w-full flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Checking…</span>
                </>
              ) : (
                <span>Verify Email &amp; Continue</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setResetError(null);
                setMode('login');
              }}
              className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-800 py-1 transition cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Sign in</span>
            </button>
          </form>
        )}

        {/* Step 2: Account Verified -> Enter & Save New Password in DB */}
        {resetStep === 'new_password' && (
          <form onSubmit={handleSavePassword} className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-emerald-50/80 border border-emerald-200 p-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-emerald-950">
                    {verifiedName}
                  </p>
                  <p className="truncate text-[11px] text-emerald-700">
                    {resetEmail}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResetStep('verify');
                  setResetError(null);
                }}
                className="text-[11px] font-semibold text-emerald-800 hover:underline shrink-0 ml-2"
              >
                Change
              </button>
            </div>

            <div>
              <label className="label">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="input pr-10"
                  disabled={isPending}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  tabIndex={-1}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ink-400 hover:text-ink-600 cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="label">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="input pr-10"
                  disabled={isPending}
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
            <div className="rounded-xl bg-ink-50/70 border border-ink-100 p-3 space-y-1">
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

            {resetError && (
              <div className="flex items-center gap-2 rounded-lg border border-coral-200 bg-coral-50 p-2.5 text-xs text-coral-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-coral-600" />
                <span>{resetError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!allRulesMet || isPending}
              className="btn-primary w-full flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving to database…</span>
                </>
              ) : (
                <span>Save New Password</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setResetError(null);
                setMode('login');
              }}
              className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-800 py-1 transition cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Cancel &amp; Back to Sign in</span>
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

      {successBanner && (
        <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-emerald-900">Success</p>
            <p className="mt-0.5">{successBanner}</p>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="email" className="label">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="input"
          placeholder="you@agency.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="password" className="label mb-0">
            Password
          </label>
          <button
            type="button"
            onClick={() => {
              setResetEmail(email);
              setResetError(null);
              setSuccessBanner(null);
              setResetStep('verify');
              setMode('reset');
            }}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
          >
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            className="input pr-10"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-400 hover:text-ink-600 focus:outline-hidden cursor-pointer"
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {state.error && (
        <div
          className={`rounded-xl border p-3.5 text-xs transition-all ${state.isLocked
            ? 'border-red-300 bg-red-50 text-red-900 shadow-sm'
            : typeof state.remainingAttempts === 'number' && state.remainingAttempts < 5
              ? 'border-amber-300 bg-amber-50 text-amber-900 shadow-sm'
              : 'border-red-200 bg-red-50 text-red-700'
            }`}
        >
          <div className="flex items-start gap-2.5">
            {state.isLocked ? (
              <ShieldAlert className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            ) : typeof state.remainingAttempts === 'number' && state.remainingAttempts < 5 ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            )}
            <div className="flex-1 space-y-1">
              {state.isLocked ? (
                <p className="font-bold text-red-950 uppercase tracking-wide text-[11px]">
                  Account Temporarily Locked (5/5 Attempts)
                </p>
              ) : typeof state.remainingAttempts === 'number' && state.remainingAttempts < 5 ? (
                <p className="font-bold text-amber-950 text-[11px] uppercase tracking-wide">
                  Login Attempt Failed ({5 - state.remainingAttempts} of 5)
                </p>
              ) : null}
              <p className="leading-relaxed">{state.error}</p>
              {state.isLocked && (
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setResetError(null);
                    setSuccessBanner(null);
                    setResetStep('verify');
                    setMode('reset');
                  }}
                  className="mt-1 text-xs font-semibold text-red-800 hover:text-red-950 underline inline-block cursor-pointer"
                >
                  Forgot password? Reset it now &rarr;
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
