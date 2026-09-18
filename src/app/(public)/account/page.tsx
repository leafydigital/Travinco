import { requireCustomer } from '@/lib/supabase/customer-auth-helpers';
import { LogOutButton } from './logout-button';
import Link from 'next/link';
import { Package, KeyRound, ArrowRight } from 'lucide-react';

export default async function AccountPage() {
  const account = await requireCustomer();

  return (
    <div className="container-page max-w-3xl pt-32 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900">
            {account.full_name ? `Hi, ${account.full_name}` : 'Your account'}
          </h1>
          <p className="mt-1 text-sm text-ink-500">{account.email}</p>
        </div>
        <LogOutButton />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link href="/account/bookings" className="card-hover flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-brand-50 p-2.5 text-brand-600">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-ink-900">My bookings</p>
              <p className="text-sm text-ink-500">See your trip history</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-ink-400" />
        </Link>

        <Link href="/account/change-password" className="card-hover flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-sand-50 p-2.5 text-sand-600">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-ink-900">Change password</p>
              <p className="text-sm text-ink-500">Update your login password</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-ink-400" />
        </Link>
      </div>
    </div>
  );
}
