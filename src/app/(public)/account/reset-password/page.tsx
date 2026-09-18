'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';
import { changeCustomerPassword } from '../actions';

function PasswordRule({ met, label }: { met: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1.5 ${met ? 'text-brand-600' : 'text-ink-400'}`}>
      {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {label}
    </li>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [password, setPassword] = useState('');

  const rules = {
    length: password.length >= 7,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
  const allRulesMet = Object.values(rules).every(Boolean);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      // Supabase's password-recovery link signs the browser in with a
      // short-lived recovery session automatically, so the same
      // updateUser() call used for a normal change-password works here
      // too — no separate reset-specific endpoint needed.
      const result = await changeCustomerPassword({ password });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Password updated — you can log in with it now.');
      router.push('/account/login');
    });
  }

  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center pt-32 pb-12">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl font-semibold text-ink-900">Set a new password</h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label">New password</label>
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
            disabled={isPending || !allRulesMet}
            className="btn-primary w-full justify-center"
          >
            {isPending ? 'Updating…' : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  );
}
