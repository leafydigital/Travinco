import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { sanitizeCookies } from '@/lib/supabase/cookie-sanitizer';
import { ADMIN_AUTH_COOKIE, CUSTOMER_AUTH_COOKIE } from '@/lib/supabase/server';
import { STAFF_CONTEXT_HEADER, encodeStaffContext } from '@/lib/supabase/staff-context';
import { PROFILE_WITH_ROLE_SELECT, roleInfoFromProfile } from '@/lib/staff-roles';

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
  // Staff sign-in lives at /app; /travinco_admin_login is a legacy alias that redirects there
  const isLegacyStaffLoginRoute =
    pathname === '/travinco_admin_login' || pathname.startsWith('/travinco_admin_login/');
  const isStaffLoginRoute = pathname === '/app' || isLegacyStaffLoginRoute;
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
  // Never trust a client-supplied staff context; only this middleware may set it (below).
  request.headers.delete(STAFF_CONTEXT_HEADER);

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
  // Set when the signed-in staff member was deactivated / deleted by an administrator
  let staffBlocked: 'deactivated' | 'deleted' | null = null;

  if ((isAdminRoute || isStaffLoginRoute) && hasAdminCookie) {
    try {
      // getClaims() verifies the JWT locally with asymmetric keys (falls back to getUser() otherwise)
      const { data: claimsData } = await adminSupabase.auth.getClaims();
      const userId = claimsData?.claims?.sub;
      if (userId) {
        // Confirm staff role in public.profiles and ensure it isn't a customer account.
        // On dashboard routes the permission rows are loaded in the same parallel round
        // and forwarded to the page (saves the page two sequential DB round trips).
        const [profileRes, { data: custAccount }, permsRes, settingRes] = await Promise.all([
          // Profile together with its role's pages (one query)
          adminSupabase
            .from('profiles')
            .select(PROFILE_WITH_ROLE_SELECT)
            .eq('id', userId)
            .maybeSingle(),
          adminSupabase
            .from('customer_accounts')
            .select('id')
            .eq('id', userId)
            .maybeSingle(),
          isAdminRoute
            ? adminSupabase.from('staff_permissions').select('*').eq('profile_id', userId)
            : Promise.resolve(null),
          isAdminRoute
            ? adminSupabase
                .from('website_settings')
                .select('value')
                .eq('key', `staff_perms_${userId}`)
                .maybeSingle()
            : Promise.resolve(null),
        ]);

        // Before the roles migration is run the embedded select fails — fall back to the plain profile
        let profile = profileRes.data as Record<string, any> | null;
        if (profileRes.error) {
          const plain = await adminSupabase.from('profiles').select('*').eq('id', userId).maybeSingle();
          profile = plain.data;
        }
        const role = profileRes.error ? null : roleInfoFromProfile(profile);
        if (profile) delete profile.staff_roles;

        if (profile && !custAccount && ['super_admin', 'admin', 'sales_staff', 'accounts_staff'].includes(profile.role)) {
          if (profile.is_deleted === true || profile.role_title === '[DELETED]') staffBlocked = 'deleted';
          else if (profile.is_active === false) staffBlocked = 'deactivated';
        }

        if (
          profile &&
          !staffBlocked &&
          profile.is_active &&
          ['super_admin', 'admin', 'sales_staff', 'accounts_staff'].includes(profile.role) &&
          !custAccount
        ) {
          adminUser = claimsData!.claims;
          isStaff = true;

          // Forward verified staff context to Server Components (same rules as getProfile():
          // customer-flagged accounts are never treated as staff there, so skip them here too).
          const meta = (claimsData!.claims.user_metadata ?? {}) as Record<string, unknown>;
          const isCustomerMeta =
            meta.is_customer_signup === 'true' ||
            meta.is_customer_signup === true ||
            meta.role === 'customer';

          if (isAdminRoute && !isCustomerMeta && permsRes && !permsRes.error && !settingRes?.error) {
            const encoded = encodeStaffContext({
              profile,
              perms: { rows: permsRes.data ?? [], settingValue: settingRes?.data?.value ?? null, role },
            });
            if (encoded) {
              request.headers.set(STAFF_CONTEXT_HEADER, encoded);
              // Rebuild the pass-through response so the new request header is forwarded,
              // keeping any refreshed session cookies.
              const prev = response;
              response = NextResponse.next({ request: { headers: request.headers } });
              prev.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
            }
          }
        }
      }
    } catch {}
  }

  // Retrieve customer user if customer cookie is present and visiting customer-gated routes or admin routes
  let customerUser = null;
  let isCustomer = false;

  // On admin routes the customer session only matters when the visitor is NOT confirmed staff
  const needsCustomerCheck =
    hasCustomerCookie &&
    ((isAdminRoute && !isStaff) || isCustomerAuthRoute || isProtectedCustomerRoute || isBookingRoute);

  if (needsCustomerCheck) {
    try {
      // getClaims() verifies the JWT locally (asymmetric keys) instead of a network round
      // trip to Supabase Auth on every account page; same check the staff branch uses.
      const { data: claimsData } = await customerSupabase.auth.getClaims();
      const claims = claimsData?.claims;
      const user = claims?.sub
        ? { id: claims.sub as string, user_metadata: (claims.user_metadata ?? {}) as Record<string, any> }
        : null;
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
      return createRedirect(new URL('/app', request.url));
    }

    if (!isStaff) {
      // Deactivated / deleted while signed in: end the staff session and explain why
      if (staffBlocked) {
        const blockedRes = createRedirect(new URL(`/app?reason=${staffBlocked}`, request.url));
        request.cookies.getAll().forEach((c) => {
          if (c.name.startsWith(ADMIN_AUTH_COOKIE)) {
            blockedRes.cookies.set(c.name, '', { path: '/', maxAge: 0, expires: new Date(0) });
          }
        });
        return blockedRes;
      }
      // If customer attempts to access admin dashboard, strictly deny access
      if (isCustomer) {
        return createRedirect(new URL('/app?reason=not_staff', request.url));
      }
      // Unauthenticated visitor -> staff sign-in
      const redirectUrl = new URL('/app', request.url);
      if (pathname !== '/travinco_dashboard') {
        redirectUrl.searchParams.set('redirectTo', pathname);
      }
      return createRedirect(redirectUrl);
    }

    // Authenticated staff allowed
    return response;
  }

  // 2. Staff Login Route Gate (/app). Legacy /travinco_admin_login* -> /app
  if (isStaffLoginRoute) {
    const redirectTo = request.nextUrl.searchParams.get('redirectTo');
    const reason = request.nextUrl.searchParams.get('reason');

    if (isLegacyStaffLoginRoute) {
      const redirectUrl = new URL('/app', request.url);
      if (redirectTo) redirectUrl.searchParams.set('redirectTo', redirectTo);
      if (reason) redirectUrl.searchParams.set('reason', reason);
      return createRedirect(redirectUrl);
    }

    // Already signed-in staff go straight to the dashboard
    if (isStaff && !reason) {
      const safePath = getSafeRedirectPath(redirectTo, '/travinco_dashboard');
      return createRedirect(
        new URL(safePath.startsWith('/travinco_dashboard') ? safePath : '/travinco_dashboard', request.url)
      );
    }
    return response;
  }

  // 3. Unified Auth Routes (/account/login, /account/signup)
  if (isCustomerAuthRoute) {
    const hasReason = request.nextUrl.searchParams.has('reason');
    const hasAction = request.nextUrl.searchParams.has('action');

    // If user is already authenticated as customer, redirect to customer account
    if (isCustomer && !hasReason && !hasAction) {
      const redirectTo = request.nextUrl.searchParams.get('redirectTo');
      const safePath = getSafeRedirectPath(redirectTo, '/account/bookings');
      return createRedirect(new URL(safePath, request.url));
    }

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
