import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient, ADMIN_AUTH_COOKIE } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Staff sign-out in ONE request: clears the (httpOnly) admin session cookies and
 * answers with an immediate 303 redirect to /app, so the browser goes straight to
 * the staff sign-in page instead of briefly showing the dashboard again.
 *
 * POST only (submitted by a form): the admin cookie is SameSite=Lax, so other
 * sites can't trigger a sign-out with a cross-site POST.
 */
export async function POST(request: NextRequest) {
  // Revoke the refresh token on Supabase, but never let it delay the redirect
  try {
    const supabase = await createAdminClient();
    await Promise.race([
      supabase.auth.signOut({ scope: 'local' }),
      new Promise((resolve) => setTimeout(resolve, 300)),
    ]);
  } catch {
    // Cookies are cleared below regardless
  }

  const response = NextResponse.redirect(new URL('/app', request.url), { status: 303 });
  response.headers.set('Cache-Control', 'no-store');

  // Remove the admin session cookie and all of its chunks
  const names = new Set<string>([ADMIN_AUTH_COOKIE]);
  for (let i = 0; i <= 5; i++) names.add(`${ADMIN_AUTH_COOKIE}.${i}`);
  request.cookies.getAll().forEach((c) => {
    if (c.name.startsWith(ADMIN_AUTH_COOKIE)) names.add(c.name);
  });
  names.forEach((name) => {
    response.cookies.set(name, '', { path: '/', maxAge: 0, expires: new Date(0) });
  });

  return response;
}
