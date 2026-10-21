import { createCustomerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { Tables } from '@/types/database';

export type CurrentCustomer = Tables<'customer_accounts'>;

/** Non-throwing customer session retriever. Reads strictly from customer-scoped session. */
export const getCustomer = cache(async (): Promise<CurrentCustomer | null> => {
  const supabase = await createCustomerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Verify that the user has a record in customer_accounts
  const { data: account } = await supabase
    .from('customer_accounts')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!account) return null;

  // Verify that customer account is not deactivated
  const { data: custRecord } = await supabase
    .from('customers')
    .select('id, is_active')
    .eq('email', account.email)
    .maybeSingle();

  if (custRecord?.is_active === false) {
    return null;
  }

  return account;
});

/**
 * Customer-side equivalent of requireProfile() — strictly enforces that the
 * authenticated session is an active customer account.
 * Redirects unauthenticated users to /account/login with safe redirectTo support.
 */
export const requireCustomer = cache(async (redirectTo?: string): Promise<CurrentCustomer> => {
  const customer = await getCustomer();

  if (!customer) {
    const target = redirectTo
      ? `/account/login?redirectTo=${encodeURIComponent(redirectTo)}`
      : '/account/login';
    redirect(target);
  }

  return customer;
});
