'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { toast } from 'sonner';

function AuthToastNotifierInner() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const hasFiredRef = useRef<string | null>(null);

  useEffect(() => {
    // 1. Handle ?signup=success (shown when arriving at /account/login after signup)
    if (searchParams.get('signup') === 'success') {
      const currentKey = `${pathname}?signup=success`;
      if (hasFiredRef.current !== currentKey) {
        hasFiredRef.current = currentKey;
        toast.success('Account created successfully! Please sign in with your email and password.');

        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('signup');
          const cleanPath = url.pathname + (url.search ? url.search : '') + url.hash;
          window.history.replaceState({}, '', cleanPath);
        } catch {}
      }
      return;
    }

    // Never show login success toast on the login page itself
    if (pathname === '/account/login' || pathname.endsWith('/login')) {
      return;
    }

    // 2. Handle ?login=success (shown when arriving at destination after login)
    if (searchParams.get('login') === 'success') {
      const currentKey = `${pathname}?login=success`;
      if (hasFiredRef.current === currentKey) {
        return;
      }
      hasFiredRef.current = currentKey;

      toast.success('Signed in successfully!');

      // Cleanly remove ?login=success from the browser address bar without reload
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('login');
        const cleanPath = url.pathname + (url.search ? url.search : '') + url.hash;
        window.history.replaceState({}, '', cleanPath);
      } catch {
        // Safe fallback
      }
    }
  }, [searchParams, pathname]);

  return null;
}

/**
 * Listens for ?login=success on destination pages after redirect,
 * displays the success toast on the destination page, and cleans the URL bar.
 */
export function AuthToastNotifier() {
  return (
    <Suspense fallback={null}>
      <AuthToastNotifierInner />
    </Suspense>
  );
}
