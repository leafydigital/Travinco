import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Tables } from '@/types/database';

export type CurrentProfile = Tables<'profiles'>;

/**
 * Fetches the logged-in user's profile row (id, role, etc). Redirects to
 * /login if there's no session. Use this at the top of every admin
 * page/layout that needs to know who's asking or gate by role — this is
 * the app-layer half of authorization; RLS is the database-layer half,
 * and neither substitutes for the other.
 */
export async function requireProfile(): Promise<CurrentProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    // A real, logged-in session exists, but it belongs to a customer
    // account (customer_accounts), not staff (profiles) — those are
    // two separate tables layered on the same underlying auth.users
    // session by design, so this is not a broken login: it's a
    // customer correctly being unable to reach the admin panel. Signing
    // them out here (rather than just redirecting) avoids a confusing
    // loop where /login sees a valid session and bounces back to
    // /admin, which then bounces back to /login again.
    await supabase.auth.signOut();
    redirect('/login?reason=not_staff');
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    redirect('/login?reason=deactivated');
  }

  return profile;
}

/** Throws-away helper for pages that need to require a specific role tier. */
export function assertRole(
  profile: CurrentProfile,
  allowed: CurrentProfile['role'][]
) {
  if (!allowed.includes(profile.role)) {
    redirect('/admin?error=forbidden');
  }
}
