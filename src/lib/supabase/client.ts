import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser client — safe to use in "use client" components.
 * Uses the public anon key only. All data access is governed by RLS.
 * Never import the service-role key here.
 *
 * INTENTIONALLY UNTYPED — see server.ts for why the Database generic
 * was removed from all Supabase clients in this project.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. ' +
        'Set them in your hosting platform\'s environment variables (e.g. Vercel Project ' +
        'Settings -> Environment Variables) and redeploy.'
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
