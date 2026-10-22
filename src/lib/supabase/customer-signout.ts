'use client';

/**
 * Fast client-side customer sign out:
 * 1. Instantly wipes the customer auth cookies from document.cookie so the browser session terminates immediately.
 * 2. Fires background server signOut non-blockingly.
 * 3. Immediately navigates to /account/login with zero UI delay.
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

  // 3. Trigger server-side logout in background without blocking UI
  try {
    import('@/app/(public)/account/actions').then(({ logOutCustomer }) => {
      logOutCustomer().catch(() => {});
    });
  } catch {}

  // 4. Instantly redirect to login page
  if (typeof window !== 'undefined') {
    window.location.href = '/account/login';
  }
}

