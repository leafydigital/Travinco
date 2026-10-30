import { NextResponse, type NextRequest } from 'next/server';
import { createCustomerClient, CUSTOMER_AUTH_COOKIE } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const REASONS = new Set(['deactivated', 'deleted']);

/**
 * Customer sign-out in ONE request: clears the (httpOnly) customer session cookies
 * and answers with an immediate 303 redirect to /account/login.
 *
 * The session cookies are httpOnly, so the browser cannot delete them itself;
 * navigating to the login page before they are cleared would let the middleware
 * see a live session and bounce the customer back to /account/bookings.
 *
 * GET is also accepted so server components can send a customer here when their
 * account was deactivated / deleted (`?reason=`).
 */
async function signOut(request: NextRequest) {
  try {
    const supabase = await createCustomerClient();
    await Promise.race([
      supabase.auth.signOut({ scope: 'local' }),
      new Promise((resolve) => setTimeout(resolve, 300)),
    ]);
  } catch {
    // Cookies are cleared below regardless
  }

  const target = new URL('/account/login', request.url);
  const reason = request.nextUrl.searchParams.get('reason');
  if (reason && REASONS.has(reason)) target.searchParams.set('reason', reason);

  const response = NextResponse.redirect(target, { status: 303 });
  response.headers.set('Cache-Control', 'no-store');

  // Remove the customer session cookie and all of its chunks
  const names = new Set<string>([CUSTOMER_AUTH_COOKIE]);
  for (let i = 0; i <= 5; i++) names.add(`${CUSTOMER_AUTH_COOKIE}.${i}`);
  request.cookies.getAll().forEach((c) => {
    if (c.name.startsWith(CUSTOMER_AUTH_COOKIE)) names.add(c.name);
  });
  names.forEach((name) => {
    response.cookies.set(name, '', { path: '/', maxAge: 0, expires: new Date(0) });
  });

  return response;
}

export const GET = signOut;
export const POST = signOut;
