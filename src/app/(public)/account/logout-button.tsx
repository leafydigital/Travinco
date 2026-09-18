'use client';

import { useTransition } from 'react';
import { LogOut } from 'lucide-react';
import { logOutCustomer } from './actions';

export function LogOutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => logOutCustomer())}
      disabled={isPending}
      className="btn-outline"
    >
      <LogOut className="h-4 w-4" /> Log out
    </button>
  );
}
