'use client';

/**
 * Fast client-side customer sign out:
 * 1. Wipes any script-readable customer auth cookies / localStorage tokens.
 * 2. Navigates to /api/auth/customer-signout, which clears the httpOnly session
 *    cookies and redirects to /account/login.
 */
export function fastCustomerLogOut(onBeforeRedirect?: () => void) {
  if (onBeforeRedirect) {
    try {
      onBeforeRedirect();
    } catch {}
  }

  // 1. Immediately wipe customer auth cookies in the browser
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
      if (
        name === 'sb-customer-auth-token' ||
        name.startsWith('sb-customer-auth-token.') ||
        name.startsWith('sb-customer-')
      ) {
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0`;
        if (typeof window !== 'undefined' && window.location.hostname) {
          document.cookie = `${name}=; path=/; domain=${window.location.hostname}; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0`;
        }
      }
    }
  }

  // 2. Clear customer localStorage tokens if any
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('sb-customer-auth-token');
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-customer') || key.includes('customer-auth'))) {
          localStorage.removeItem(key);
        }
      }
    }
  } catch {}

  // 3. Sign out on the server and land on the login page in one round trip.
  //    The session cookies are httpOnly (step 1 can't remove them), so the server
  //    route clears them and redirects; going straight to /account/login would let
  //    the middleware see the still-valid session and bounce back to /account/bookings.
  if (typeof window !== 'undefined') {
    window.location.replace('/api/auth/customer-signout');
  }
}

