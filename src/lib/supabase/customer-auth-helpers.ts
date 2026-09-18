import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Tables } from '@/types/database';

export type CurrentCustomer = Tables<'customer_accounts'>;

/**
 * Customer-side equivalent of requireProfile() (see
 * lib/supabase/auth-helpers.ts) — deliberately a separate function
 * reading a separate table, so a customer session can never be treated
 * as staff/admin access anywhere in the app.
 */
export async function requireCustomer(): Promise<CurrentCustomer> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/account/login');
  }

  const { data: account, error } = await supabase
    .from('customer_accounts')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !account) {
    redirect('/account/login');
  }

  return account;
}
