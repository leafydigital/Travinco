import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client — BYPASSES ROW LEVEL SECURITY entirely.
 *
 * The `server-only` import above makes Next.js throw a build error if this
 * file is ever imported from a Client Component or any code that could end
 * up in the browser bundle. Do not remove that import.
 *
 * Use ONLY for operations that must run with elevated privileges and that
 * have already been authorized by your own application logic — e.g.
 * creating an admin user, running the local seed script, or a webhook
 * handler verified by a signature. Every call site must independently
 * verify the caller is allowed to perform the action; this client will not
 * stop them.
 *
 * NEVER expose SUPABASE_SERVICE_ROLE_KEY to the client. NEVER import this
 * module from src/app/(public)/** or any "use client" file.
 *
 * INTENTIONALLY UNTYPED — see server.ts for why the Database generic
 * was removed from all Supabase clients in this project.
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set. Refusing to create a service client.');
  }
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Refusing to create a service client.'
    );
  }

  return createSupabaseClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}