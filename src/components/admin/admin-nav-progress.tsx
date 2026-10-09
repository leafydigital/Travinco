'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export function AdminNavProgress() {
  const pathname = usePathname();
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    // Hide progress bar whenever route change completes
    setNavigating(false);
  }, [pathname]);

  useEffect(() => {
    if (!navigating) return;
    const timeout = setTimeout(() => setNavigating(false), 8000);
    return () => clearTimeout(timeout);
  }, [navigating]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Find nearest anchor tag clicked
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;

      const href = target.getAttribute('href');
      // Only trigger for internal admin routes that aren't the same page or hash links
      if (
        href &&
        href.startsWith('/admin') &&
        !href.startsWith('/admin#') &&
        href !== pathname &&
        !target.hasAttribute('download') &&
        target.getAttribute('target') !== '_blank'
      ) {
        setNavigating(true);
      }
    };

    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, [pathname]);

  if (!navigating) return null;

  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      className="pointer-events-none fixed top-0 left-0 right-0 z-[9999] h-[3px] overflow-hidden bg-brand-100"
    >
      <div className="h-full w-full bg-gradient-to-r from-coral-500 via-amber-400 to-teal-500 animate-pulse origin-left duration-300" />
    </div>
  );
}
