import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { sanitizeCookies } from '@/lib/supabase/cookie-sanitizer';

/** Sanitizes and validates a redirect path to prevent open redirect vulnerabilities. */
function getSafeRedirectPath(rawPath: string | null | undefined, fallback: string): string {
  if (!rawPath || !rawPath.startsWith('/') || rawPath.startsWith('//') || rawPath.includes('\\')) {
    return fallback;
  }
  return rawPath;
}

/**
 * Runs on every request. Jobs:
 * 1. Refresh the Supabase SSR auth session cookie so it does not expire.
 * 2. Gate /admin/** — unauthenticated visitors are redirected to /login with safe return URL.
 * 3. Gate protected /account/** routes — unauthenticated visitors are redirected to /account/login with safe return URL.
 * 4. Separate customer sessions from staff access:
 *    - Customers are strictly denied from /admin/** and redirected to /login?reason=not_staff.
 *    - Authenticated staff visiting /login are redirected to /admin.
 *    - Authenticated customers visiting /account/login or /account/signup are redirected to /account/bookings.
 *    - Authenticated customers visiting /login are redirected to /account/bookings.
 * 5. Role and module-based authorization is further strictly enforced inside Server Components and Actions.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      'Middleware: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY are not set.'
    );
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          const sanitized = sanitizeCookies(cookiesToSet);
          sanitized.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          sanitized.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAdminRoute = pathname.startsWith('/admin');
  const isStaffLoginRoute = pathname === '/login' || pathname.startsWith('/login/');
  const isCustomerAuthRoute =
    pathname === '/account/login' ||
    pathname === '/account/signup' ||
    pathname === '/account/reset-password';
  const isProtectedCustomerRoute =
    pathname.startsWith('/account') && !isCustomerAuthRoute;

  // Helper to create redirect response while preserving any refreshed session cookies
  function createRedirect(url: URL | string) {
    const redirectRes = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirectRes.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectRes;
  }

  const isCustomer = user?.user_metadata?.is_customer_signup === 'true';

  // 1. Unauthenticated Visitor Handling
  if (!user) {
    if (isAdminRoute) {
      const redirectUrl = new URL('/login', request.url);
      if (pathname !== '/admin') {
        redirectUrl.searchParams.set('redirectTo', pathname);
      }
      return createRedirect(redirectUrl);
    }

    if (isProtectedCustomerRoute) {
      const redirectUrl = new URL('/account/login', request.url);
      redirectUrl.searchParams.set('redirectTo', pathname);
      return createRedirect(redirectUrl);
    }

    return response;
  }

  // 2. Authenticated Customer Handling
  if (isCustomer) {
    // Customers must NEVER access /admin/**
    if (isAdminRoute) {
      return createRedirect(new URL('/login?reason=not_staff', request.url));
    }

    // Customer visiting staff login should go to their account bookings
    if (isStaffLoginRoute) {
      return createRedirect(new URL('/account/bookings', request.url));
    }

    // Customer visiting customer login/signup should be sent to their account
    if (isCustomerAuthRoute) {
      const redirectTo = request.nextUrl.searchParams.get('redirectTo');
      const safePath = getSafeRedirectPath(redirectTo, '/account/bookings');
      return createRedirect(new URL(safePath, request.url));
    }

    return response;
  }

  // 3. Authenticated Staff Handling
  // Staff visiting staff login should go to admin or redirectTo
  if (isStaffLoginRoute) {
    const redirectTo = request.nextUrl.searchParams.get('redirectTo');
    const safePath = getSafeRedirectPath(redirectTo, '/admin');
    return createRedirect(new URL(safePath, request.url));
  }

  // Staff visiting customer auth routes (e.g. /account/login) should go to admin
  if (isCustomerAuthRoute) {
    return createRedirect(new URL('/admin', request.url));
  }

  // Staff visiting customer-only protected routes (e.g. /account/bookings)
  if (isProtectedCustomerRoute) {
    return createRedirect(new URL('/admin', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets and Next.js internals, so the
     * session cookie stays fresh across the whole app without wasting
     * cycles on images/fonts/etc.
     */
    '/((?!_next/static|_next/image|favicon.ico|images|.*\\.(?:svg|png|jpg|jpeg|webp|avif)$).*)',
  ],
};
