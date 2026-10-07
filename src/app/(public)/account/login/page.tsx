'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { logInCustomer, requestPasswordReset } from '../actions';

const REASON_MESSAGES: Record<string, string> = {
  not_customer: 'This section is for customer accounts only. Staff members please use the staff portal.',
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo');
  const reason = searchParams.get('reason');

  const [isPending, startTransition] = useTransition();
  const [isResetting, startReset] = useTransition();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  function getSafeRedirect(path: string | null): string {
    if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
      return '/account/bookings';
    }
    return path;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await logInCustomer({ email, password });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Signed in successfully');
      router.push(getSafeRedirect(redirectTo));
      router.refresh();
    });
  }

  function handleForgotPassword() {
    if (!email.includes('@')) {
      toast.error('Enter your email above first, then click "Forgot password".');
      return;
    }
    startReset(async () => {
      await requestPasswordReset(email);
      setResetSent(true);
      toast.success('If that email has an account, a reset link is on its way.');
    });
  }

  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center pt-32 pb-12">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl font-semibold text-ink-900">Customer Log in</h1>
        <p className="mt-1 text-sm text-ink-500">See your booking history and manage your trips.</p>

        {reason && REASON_MESSAGES[reason] && (
          <p className="mt-4 rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-xs text-sand-800">
            {REASON_MESSAGES[reason]}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label">Email address</label>
            <input
              type="email"
              required
              placeholder="you@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label">Password</label>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isResetting}
                className="text-xs text-brand-600 hover:underline"
              >
                {isResetting ? 'Sending…' : 'Forgot password?'}
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-400 hover:text-ink-600 focus:outline-none"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {resetSent && (
            <p className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-700">
              If that email has an account, a password reset link is on its way — check your
              inbox.
            </p>
          )}
          <button type="submit" disabled={isPending} className="btn-primary w-full justify-center">
            {isPending ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-ink-500">
          Don&apos;t have an account?{' '}
          <Link href="/account/signup" className="text-brand-600 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
