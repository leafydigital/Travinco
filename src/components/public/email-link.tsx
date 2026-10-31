'use client';

import { useRef } from 'react';
import { toast } from 'sonner';
import { mailHref } from '@/lib/contact-links';

/** How long to wait for the mail app to take focus before offering web mail. */
const MAIL_APP_WAIT_MS = 900;

function gmailComposeUrl(email: string) {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`;
}

function outlookComposeUrl(email: string) {
  return `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(email)}`;
}

/**
 * Email link that always does something. A plain mailto: link does nothing on
 * computers without a default email app (common on Windows), so when the
 * browser keeps focus after the click we copy the address and offer Gmail or
 * Outlook on the web instead.
 */
export function EmailLink({
  email,
  className,
  children,
  'aria-label': ariaLabel,
}: {
  email: string;
  className?: string;
  children: React.ReactNode;
  'aria-label'?: string;
}) {
  const timer = useRef<number | null>(null);

  function handleClick() {
    const address = email.trim();
    let mailAppOpened = false;
    const onLeave = () => {
      mailAppOpened = true;
    };
    window.addEventListener('blur', onLeave, { once: true });
    document.addEventListener('visibilitychange', onLeave, { once: true });

    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      window.removeEventListener('blur', onLeave);
      document.removeEventListener('visibilitychange', onLeave);
      if (mailAppOpened) return;

      navigator.clipboard?.writeText(address).catch(() => {});
      toast(`Email us at ${address}`, {
        description: 'No email app opened on this device, so we copied the address. Or write from your web mail:',
        duration: 10000,
        action: {
          label: 'Open Gmail',
          onClick: () => window.open(gmailComposeUrl(address), '_blank', 'noopener,noreferrer'),
        },
        cancel: {
          label: 'Outlook',
          onClick: () => window.open(outlookComposeUrl(address), '_blank', 'noopener,noreferrer'),
        },
      });
    }, MAIL_APP_WAIT_MS);
    // The mailto: navigation itself is left to the browser (no preventDefault)
  }

  return (
    <a href={mailHref(email)} onClick={handleClick} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  );
}
