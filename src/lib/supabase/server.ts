import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server client for use in Server Components, Server Actions and Route
 * Handlers. Reads/writes the auth session via cookies. Uses the anon key —
 * the logged-in user's session determines what RLS allows, exactly as it
 * should. Do NOT use this for privileged operations; use service.ts.
 *
 * INTENTIONALLY UNTYPED (no Database generic): a hand-authored Database
 * type caused every .from(table) query to resolve to `never` under this
 * project's installed TypeScript/@supabase/supabase-js version
 * combination, regardless of the type's actual content — confirmed via
 * module-resolution tracing, file-hash checks, and duplicate-file
 * searches, all of which came back clean. Removing the generic sidesteps
 * that incompatibility entirely. Row shapes are still described in
 * src/types/database.ts for use in application code; they're just not
 * wired into the client's generic parameter anymore.
 */
export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. ' +
        'Set them in your hosting platform\'s environment variables (e.g. Vercel Project ' +
        'Settings -> Environment Variables) and redeploy.'
    );
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — safe to ignore when
            // middleware is refreshing the session on every request.
          }
        },
      },
    }
  );
}