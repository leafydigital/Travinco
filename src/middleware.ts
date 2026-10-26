import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { sanitizeCookies } from '@/lib/supabase/cookie-sanitizer';
import { ADMIN_AUTH_COOKIE, CUSTOMER_AUTH_COOKIE } from '@/lib/supabase/server';

/** Sanitizes and validates a redirect path to prevent open redirect vulnerabilities. */
function getSafeRedirectPath(rawPath: string | null | undefined, fallback: string): string {
  if (!rawPath || !rawPath.startsWith('/') || rawPath.startsWith('//') || rawPath.includes('\\')) {
    return fallback;
  }
  return rawPath;
}

/**
 * Runs on every request. Jobs:
 * 1. Refresh Supabase SSR auth session cookies (admin and customer isolated).
 * 2. Gate /travinco_dashboard/** — unauthenticated visitors redirected to /travinco_admin_login.
 * 3. Gate customer routes (/account/**, /booking) — unauthenticated visitors redirected to /account/login.
 * 4. Separate customer sessions from staff access:
 *    - Customers are strictly denied from /travinco_dashboard/** and redirected to /travinco_admin_login?reason=not_staff.
 *    - Authenticated staff visiting /travinco_admin_login redirected to dashboard.
 *    - Authenticated customers visiting /account/login redirected to /account/bookings.
 *    - Admin session alone NEVER counts as customer authentication; customer login page remains accessible.
 *    - Both sessions can safely coexist in the same browser.
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAdminRoute = pathname.startsWith('/travinco_dashboard');
  const isStaffLoginRoute = pathname === '/travinco_admin_login' || pathname.startsWith('/travinco_admin_login/');
  const isCustomerAuthRoute =
    pathname === '/account/login' ||
    pathname === '/account/signup' ||
    pathname === '/account/reset-password';
  const isProtectedCustomerRoute =
    pathname.startsWith('/account') && !isCustomerAuthRoute;
  const isBookingRoute = pathname === '/booking' || pathname.startsWith('/booking/');

  // Forward request headers with context hints for downstream Server Components
  request.headers.set('x-pathname', pathname);
  request.headers.set(
    'x-travinco-area',
    isAdminRoute || isStaffLoginRoute ? 'admin' : 'customer'
  );

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

  // Helper to create redirect response while preserving any refreshed session cookies
  function createRedirect(url: URL | string) {
    const redirectRes = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirectRes.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectRes;
  }

  // Redirect legacy /admin routes to /travinco_dashboard
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const target = pathname.replace(/^\/admin/, '/travinco_dashboard') + request.nextUrl.search;
    return createRedirect(new URL(target, request.url));
  }

  // Redirect legacy /login routes to /account/login
  if (pathname === '/login' || pathname.startsWith('/login/')) {
    const target = '/account/login' + request.nextUrl.search;
    return createRedirect(new URL(target, request.url));
  }

  // Factory for scoped Supabase SSR clients
  function createScopedMiddlewareClient(cookieName: string) {
    return createServerClient(
      supabaseUrl!,
      supabaseAnonKey!,
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
  }

  const adminSupabase = createScopedMiddlewareClient(ADMIN_AUTH_COOKIE);
  const customerSupabase = createScopedMiddlewareClient(CUSTOMER_AUTH_COOKIE);

  const hasAdminCookie =
    request.cookies.has(ADMIN_AUTH_COOKIE) ||
    request.cookies.has(`${ADMIN_AUTH_COOKIE}.0`);

  const hasCustomerCookie =
    request.cookies.has(CUSTOMER_AUTH_COOKIE) ||
    request.cookies.has(`${CUSTOMER_AUTH_COOKIE}.0`);

  // Retrieve admin user ONLY if visiting admin/staff-login routes AND admin cookie is present
  let adminUser = null;
  let isStaff = false;

  if ((isAdminRoute || isStaffLoginRoute) && hasAdminCookie) {
    try {
      const { data: { user } } = await adminSupabase.auth.getUser();
      if (user) {
        // Confirm staff role in public.profiles
        const { data: profile } = await adminSupabase
          .from('profiles')
          .select('role, is_active')
          .eq('id', user.id)
          .maybeSingle();

        if (
          profile &&
          profile.is_active &&
          ['super_admin', 'admin', 'sales_staff', 'accounts_staff'].includes(profile.role)
        ) {
          const { data: custAccount } = await adminSupabase
            .from('customer_accounts')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();

          if (!custAccount) {
            adminUser = user;
            isStaff = true;
          }
        }
      }
    } catch {}
  }

  // Retrieve customer user if customer cookie is present and visiting customer-gated routes or admin routes
  let customerUser = null;
  let isCustomer = false;

  const needsCustomerCheck =
    hasCustomerCookie &&
    (isAdminRoute || isCustomerAuthRoute || isProtectedCustomerRoute || isBookingRoute);

  if (needsCustomerCheck) {
    try {
      const { data: { user } } = await customerSupabase.auth.getUser();
      if (user) {
        const isCustomerMeta =
          user.user_metadata?.is_customer_signup === 'true' ||
          user.user_metadata?.is_customer_signup === true ||
          user.user_metadata?.role === 'customer';

        if (isCustomerMeta) {
          customerUser = user;
          isCustomer = true;
        } else {
          const { data: custAccount } = await customerSupabase
            .from('customer_accounts')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();

          if (custAccount) {
            customerUser = user;
            isCustomer = true;
          }
        }
      }
    } catch {}
  }

  // 1. Admin Routes Gate (/travinco_dashboard/**)
  if (isAdminRoute) {
    if (pathname === '/travinco_dashboard/login') {
      return createRedirect(new URL('/travinco_admin_login', request.url));
    }

    if (!isStaff) {
      // If customer attempts to access admin dashboard, strictly deny access
      if (isCustomer) {
        return createRedirect(new URL('/travinco_admin_login?reason=not_staff', request.url));
      }
      // Unauthenticated visitor
      const redirectUrl = new URL('/travinco_admin_login', request.url);
      if (pathname !== '/travinco_dashboard') {
        redirectUrl.searchParams.set('redirectTo', pathname);
      }
      return createRedirect(redirectUrl);
    }

    // Authenticated staff allowed
    return response;
  }

  // 2. Staff Login Route Gate (/travinco_admin_login)
  if (isStaffLoginRoute) {
    if (isStaff) {
      if (
        pathname.startsWith('/travinco_admin_login/reset-password') ||
        request.nextUrl.searchParams.has('reason')
      ) {
        return response;
      }
      const redirectTo = request.nextUrl.searchParams.get('redirectTo');
      const safePath = getSafeRedirectPath(redirectTo, '/travinco_dashboard');
      return createRedirect(new URL(safePath, request.url));
    }
    return response;
  }

  // 3. Customer Auth Routes (/account/login, /account/signup)
  if (isCustomerAuthRoute) {
    // If user is already authenticated as customer, redirect to customer account
    if (isCustomer) {
      const redirectTo = request.nextUrl.searchParams.get('redirectTo');
      const safePath = getSafeRedirectPath(redirectTo, '/account/bookings');
      return createRedirect(new URL(safePath, request.url));
    }

    // Admin session alone does NOT redirect away from customer login. Display login form!
    return response;
  }

  // 4. Protected Customer Routes (/account/** except auth)
  if (isProtectedCustomerRoute) {
    if (!isCustomer) {
      const redirectUrl = new URL('/account/login', request.url);
      redirectUrl.searchParams.set('redirectTo', pathname);
      return createRedirect(redirectUrl);
    }
    return response;
  }

  // 5. Booking Flow (/booking) is now accessible to all visitors (authenticated & unauthenticated)

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
