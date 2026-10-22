'use client';

import { LogOut } from 'lucide-react';
import { fastCustomerLogOut } from '@/lib/supabase/customer-signout';

export function LogOutButton() {
  return (
    <button
      type="button"
      onClick={() => fastCustomerLogOut()}
      className="btn-outline"
    >
      <LogOut className="h-4 w-4" /> Log out
    </button>
  );
}

