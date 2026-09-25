'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Silently calls router.refresh() on an interval, so a Server
 * Component page re-fetches its data without the visitor needing to
 * reload manually. Renders nothing — just sits in the tree and ticks.
 * Scoped to whichever page renders it (e.g. only the Enquiries list),
 * not applied globally, so it doesn't add background traffic to pages
 * that don't need it.
 */
export function AutoRefresh({ intervalMs = 30000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
