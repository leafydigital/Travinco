'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { logInCustomer, requestPasswordReset } from '../actions';

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isResetting, startReset] = useTransition();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetSent, setResetSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await logInCustomer({ email, password });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.push('/account');
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
      // Always show the same message, whether or not the email exists,
      // so this can't be used to check which emails have accounts.
      setResetSent(true);
      toast.success('If that email has an account, a reset link is on its way.');
    });
  }

  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center pt-32 pb-12">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl font-semibold text-ink-900">Log in</h1>
        <p className="mt-1 text-sm text-ink-500">See your booking history and manage your trips.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
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
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
          </div>
          {resetSent && (
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
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
