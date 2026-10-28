import { createCustomerClient, CUSTOMER_AUTH_COOKIE } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { Tables } from '@/types/database';

export type CurrentCustomer = Tables<'customer_accounts'>;

/** Non-throwing customer session retriever. Reads strictly from customer-scoped session. */
export const getCustomer = cache(async (): Promise<CurrentCustomer | null> => {
  const cookieStore = await cookies();
  const hasCustomerCookie =
    cookieStore.has(CUSTOMER_AUTH_COOKIE) ||
    cookieStore.has(`${CUSTOMER_AUTH_COOKIE}.0`);

  if (!hasCustomerCookie) return null;

  const supabase = await createCustomerClient();
  // getClaims() verifies the JWT locally (ES256 signing keys) instead of a ~1s
  // round trip to the Auth server; it falls back to getUser() for symmetric keys.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return null;

  const user = {
    id: claims.sub as string,
    email: (claims.email as string | undefined) || undefined,
    user_metadata: (claims.user_metadata ?? {}) as Record<string, any>,
  };

  // Verify customer_accounts and customer status in parallel
  const [accountRes, custRecordRes] = await Promise.all([
    supabase
      .from('customer_accounts')
      .select('*')
      .eq('id', user.id)
      .maybeSingle(),
    user.email
      ? supabase
          .from('customers')
          .select('id, is_active')
          .eq('email', user.email)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (custRecordRes.data?.is_active === false) {
    return null;
  }

  const account = accountRes.data;
  if (account) return account;

  // Fallback if customer_accounts record has not synced yet
  const isCustomerMeta =
    user.user_metadata?.role === 'customer' ||
    user.user_metadata?.is_customer_signup === 'true';

  if (isCustomerMeta && user.email) {
    return {
      id: user.id,
      email: user.email,
      full_name: (user.user_metadata?.full_name as string) || user.email.split('@')[0],
      username: (user.user_metadata?.username as string) || user.email.split('@')[0],
      // Rare fallback path only: created_at isn't in the JWT, fetch it from Auth
      created_at: (await supabase.auth.getUser()).data.user?.created_at ?? new Date().toISOString(),
    } as CurrentCustomer;
  }

  return null;
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
