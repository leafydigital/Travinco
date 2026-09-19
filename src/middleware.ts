import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Runs on every request. Two jobs:
 * 1. Refresh the Supabase auth session cookie so it doesn't expire under
 *    long-lived Server Components.
 * 2. Gate /admin/** — unauthenticated visitors are redirected to
 *    /login. Role-based access (which admin role can see which page) is
 *    enforced again inside each admin page/layout via the database
 *    profiles.role column — middleware only proves "is logged in", never
 *    "is authorized for this page", since role checks need a DB read that
 *    is safer to do closer to the data.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // A missing/misconfigured env var here otherwise throws a generic,
    // hard-to-diagnose crash (previously via a `!` non-null assertion)
    // during every request, including Next.js's own _not-found page
    // generation at build time — which is exactly what broke the
    // Vercel build that led to this check being added. This makes the
    // real cause immediately obvious in the build/runtime logs instead.
    console.error(
      'Middleware: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. ' +
        'Set them in your hosting platform\'s environment variables and redeploy.'
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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin');
  const isLoginRoute = request.nextUrl.pathname.startsWith('/login');

  if (isAdminRoute && !user) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isLoginRoute && user) {
    return NextResponse.redirect(new URL('/admin', request.url));
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