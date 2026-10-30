'use client';

import { useState } from 'react';
import { User, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { staffLogin } from './actions';

export function StaffLoginForm({
  redirectTo,
  notice,
}: {
  redirectTo?: string;
  notice?: string | null;
}) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ message: string; isLocked?: boolean } | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await staffLogin({ identifier, password, redirectTo });
      if (!result.success) {
        setError({ message: result.error || 'Unable to sign in.', isLocked: result.isLocked });
        setIsLoading(false);
        return;
      }
      // Keep "Signing in…" until the dashboard opens
      window.location.assign(result.redirectUrl || '/travinco_dashboard');
    } catch {
      setError({ message: 'Unable to sign in right now. Please try again.' });
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-ink-100 bg-white p-6 shadow-xl sm:p-8">
      <div className="mb-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/green_logo.png"
          alt="Travinco"
          className="mx-auto mb-4 h-14 w-auto object-contain"
        />
        <h1 className="font-display text-2xl font-bold text-ink-900">Team sign in</h1>
        <p className="mt-1 text-sm text-ink-500">Travinco admin &amp; staff portal</p>
      </div>

      {notice && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{notice}</div>
      )}

      <form onSubmit={handleLogin} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="staff-identifier">
            Username / Email
          </label>
          <div className="relative">
            <input
              id="staff-identifier"
              type="text"
              required
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              disabled={isLoading}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Username or you@travinco.in"
              className="input pl-10"
            />
            <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="staff-password">
            Password
          </label>
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

        {error && (
          <div
            role="alert"
            className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${
              error.isLocked ? 'border-red-200 bg-red-50 text-red-800' : 'border-coral-200 bg-coral-50 text-coral-700'
            }`}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error.message}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !identifier.trim() || !password}
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
    </div>
  );
}
