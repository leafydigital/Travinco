'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';
import { createStaffUser } from './actions';

function PasswordRule({ met, label }: { met: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1.5 ${met ? 'text-brand-600' : 'text-ink-400'}`}>
      {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {label}
    </li>
  );
}

export function UserForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'sales_staff' | 'accounts_staff'>('sales_staff');

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
      const result = await createStaffUser({ full_name: fullName, email, password, role });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('User created');
      router.push('/admin/users');
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-5">
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
        <label className="label">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          className="input"
        >
          <option value="admin">Admin</option>
          <option value="sales_staff">Sales staff</option>
          <option value="accounts_staff">Accounts staff</option>
        </select>
        <p className="mt-1 text-xs text-ink-400">
          A new super_admin can&apos;t be created here — that role is reserved for the main
          account.
        </p>
      </div>
      <div>
        <label className="label">Temporary password</label>
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
        {isPending ? 'Creating…' : 'Create user'}
      </button>
    </form>
  );
}
