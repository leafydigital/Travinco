'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';
import { signUpCustomer } from '../actions';

function PasswordRule({ met, label }: { met: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1.5 ${met ? 'text-brand-600' : 'text-ink-400'}`}>
      {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {label}
    </li>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const rules = {
    length: password.length >= 7,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
  const allRulesMet = Object.values(rules).every(Boolean);
  const emailIsGmail = email.trim().toLowerCase().endsWith('@gmail.com');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await signUpCustomer({ full_name: fullName, email, password });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Account created! Check your email to confirm, then log in.');
      router.push('/account/login');
    });
  }

  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center pt-32 pb-12">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl font-semibold text-ink-900">Create your account</h1>
        <p className="mt-1 text-sm text-ink-500">See your booking history and manage your trips.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label">Full name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Gmail address</label>
            <input
              type="email"
              required
              placeholder="you@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
            {email.length > 0 && !emailIsGmail && (
              <p className="mt-1 text-xs text-coral-600">Only @gmail.com addresses are accepted.</p>
            )}
            <p className="mt-1 text-xs text-ink-400">
              We&apos;ll send a confirmation link to this address — use the same one you gave us
              when booking, so past trips show up automatically.
            </p>
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
            <ul className="mt-2 grid grid-cols-2 gap-1 text-xs">
              <PasswordRule met={rules.length} label="7+ characters" />
              <PasswordRule met={rules.upper} label="1 capital letter" />
              <PasswordRule met={rules.lower} label="1 lowercase letter" />
              <PasswordRule met={rules.number} label="1 number" />
              <PasswordRule met={rules.symbol} label="1 symbol (e.g. !@#)" />
            </ul>
          </div>
          <button
            type="submit"
            disabled={isPending || !allRulesMet || !emailIsGmail}
            className="btn-primary w-full justify-center"
          >
            {isPending ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-ink-500">
          Already have an account?{' '}
          <Link href="/account/login" className="text-brand-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
