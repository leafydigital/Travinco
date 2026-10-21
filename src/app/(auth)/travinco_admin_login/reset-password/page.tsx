'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { KeyRound, Eye, EyeOff, Check, Circle, Loader2, AlertCircle } from 'lucide-react';
import { completeStaffPasswordReset } from '../actions';

export default function AdminResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRulesMet || isPending) return;

    setErrorMessage(null);
    startTransition(async () => {
      const res = await completeStaffPasswordReset({
        password,
        confirmPassword,
      });

      if (res?.error) {
        setErrorMessage(res.error);
        toast.error(res.error);
      } else {
        toast.success('Password updated successfully!');
        router.push('/travinco_admin_login?reason=reset_success');
      }
    });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="card w-full max-w-md p-8 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-display text-xl font-bold tracking-tight text-brand-700">
            Travinco
          </span>
          <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-brand-700">
            Staff Portal
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-ink-900">Create New Password</h1>
            <p className="text-xs text-ink-500">
              Enter and confirm your new secure password.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-coral-50 border border-coral-200 p-3 text-xs text-coral-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-coral-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="label">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input pr-10"
                disabled={isPending}
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
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
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

          {/* Checklist */}
          <div className="rounded-xl bg-ink-50/70 border border-ink-100 p-3 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-1">
              Password Requirements:
            </p>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <div
                className={`flex items-center gap-1.5 ${
                  rules.length ? 'text-emerald-700 font-medium' : 'text-ink-400'
                }`}
              >
                {rules.length ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-ink-300 shrink-0" />
                )}
                <span>7+ characters</span>
              </div>

              <div
                className={`flex items-center gap-1.5 ${
                  rules.upper ? 'text-emerald-700 font-medium' : 'text-ink-400'
                }`}
              >
                {rules.upper ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-ink-300 shrink-0" />
                )}
                <span>Uppercase (A-Z)</span>
              </div>

              <div
                className={`flex items-center gap-1.5 ${
                  rules.lower ? 'text-emerald-700 font-medium' : 'text-ink-400'
                }`}
              >
                {rules.lower ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-ink-300 shrink-0" />
                )}
                <span>Lowercase (a-z)</span>
              </div>

              <div
                className={`flex items-center gap-1.5 ${
                  rules.number ? 'text-emerald-700 font-medium' : 'text-ink-400'
                }`}
              >
                {rules.number ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-ink-300 shrink-0" />
                )}
                <span>Number (0-9)</span>
              </div>

              <div
                className={`flex items-center gap-1.5 ${
                  rules.symbol ? 'text-emerald-700 font-medium' : 'text-ink-400'
                }`}
              >
                {rules.symbol ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-ink-300 shrink-0" />
                )}
                <span>Symbol (!@#$%)</span>
              </div>

              <div
                className={`flex items-center gap-1.5 ${
                  rules.matches ? 'text-emerald-700 font-medium' : 'text-ink-400'
                }`}
              >
                {rules.matches ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-ink-300 shrink-0" />
                )}
                <span>Passwords match</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!allRulesMet || isPending}
            className="btn-primary w-full flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Updating password…</span>
              </>
            ) : (
              <span>Update Password &amp; Sign in</span>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
