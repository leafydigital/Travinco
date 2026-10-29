import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sanitizeCookies } from './cookie-sanitizer';

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
export const ADMIN_AUTH_COOKIE = 'sb-admin-auth-token';
export const CUSTOMER_AUTH_COOKIE = 'sb-customer-auth-token';

/**
 * Creates a scoped Supabase server client bound to a specific cookie name.
 * Admin and customer authentication sessions are isolated by distinct cookie names
 * and distinct storage keys so they can coexist safely in the same browser.
 */
export async function createScopedClient(cookieName: string) {
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
      cookieOptions: {
        name: cookieName,
        path: '/',
        sameSite: 'lax',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            const sanitized = sanitizeCookies(cookiesToSet);
            sanitized.forEach(({ name, value, options }) =>
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

/** Admin/staff server client using isolated sb-admin-auth-token cookie */
export async function createAdminClient() {
  return createScopedClient(ADMIN_AUTH_COOKIE);
}

/** Customer server client using isolated sb-customer-auth-token cookie */
export async function createCustomerClient() {
  return createScopedClient(CUSTOMER_AUTH_COOKIE);
}

/**
 * General server client for use in Server Components, Server Actions and Route Handlers.
 * Automatically resolves to the admin client or customer client based on request context,
 * role parameter, or active session cookies.
 */
export async function createClient(options?: { role?: 'admin' | 'customer' }) {
  if (options?.role === 'customer') {
    return createCustomerClient();
  }
  if (options?.role === 'admin') {
    return createAdminClient();
  }

  // Detect context via headers if available
  try {
    const { headers } = await import('next/headers');
    const headersList = await headers();
    const area = headersList.get('x-travinco-area');
    const pathname = headersList.get('x-pathname') || '';

    if (area === 'customer' || pathname.startsWith('/account') || pathname.startsWith('/booking')) {
      return createCustomerClient();
    }
    if (
      area === 'admin' ||
      pathname.startsWith('/travinco_dashboard') ||
      pathname.startsWith('/travinco_admin_login') ||
      pathname === '/app'
    ) {
      return createAdminClient();
    }
  } catch {}

  // Fallback to checking cookie presence
  try {
    const cookieStore = await cookies();
    if (cookieStore.get(ADMIN_AUTH_COOKIE) || cookieStore.get(`${ADMIN_AUTH_COOKIE}.0`)) {
      return createAdminClient();
    }
    if (cookieStore.get(CUSTOMER_AUTH_COOKIE) || cookieStore.get(`${CUSTOMER_AUTH_COOKIE}.0`)) {
      return createCustomerClient();
    }
  } catch {}

  return createAdminClient();
}
