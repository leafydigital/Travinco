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
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
