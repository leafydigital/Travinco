'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

/**
 * Goes back to the previous page when the visitor came from this site (keeps their
 * search, filters and page), otherwise opens `fallbackHref`.
 */
export function BackButton({
  fallbackHref,
  label = 'Back',
  className,
}: {
  fallbackHref: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  function handleClick() {
    let cameFromSite = false;
    try {
      cameFromSite = Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin;
    } catch {}
    if (cameFromSite && window.history.length > 1) router.back();
    else router.push(fallbackHref);
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      <ArrowLeft className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}
