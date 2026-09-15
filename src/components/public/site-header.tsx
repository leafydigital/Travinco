'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MessageCircle, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/packages', label: 'Packages' },
  { href: '/destinations', label: 'Destinations' },
  { href: '/offers', label: 'Offers' },
  { href: '/events', label: 'Events' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

/**
 * Transparent-over-hero on the homepage (mirrors travinco.com's header,
 * which sits on top of the hero image until you scroll), solid white on
 * every other page where there's no dark hero behind it.
 */
export function SiteHeader({ whatsappNumber }: { whatsappNumber?: string }) {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isHome) return;
    function onScroll() {
      setScrolled(window.scrollY > 40);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isHome]);

  const overlayMode = isHome && !scrolled;

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 transition-all duration-300',
        overlayMode
          ? 'bg-transparent'
          : 'border-b border-ink-100 bg-white/95 shadow-sm backdrop-blur'
      )}
    >
      <div className="container-page flex h-20 items-center justify-between">
        <Link
          href="/"
          className={cn(
            'font-display text-xl font-semibold transition-colors',
            overlayMode ? 'text-white' : 'text-brand-700'
          )}
        >
          Travinco
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm font-medium transition-colors',
                overlayMode ? 'text-white/90 hover:text-white' : 'text-ink-600 hover:text-brand-700'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'btn-outline',
                overlayMode && 'border-white/40 bg-transparent text-white hover:bg-white/10'
              )}
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          )}
          <Link href="/booking" className="btn-cta">
            Book with us
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className={cn(
            'rounded-lg p-2 lg:hidden',
            overlayMode ? 'text-white' : 'text-ink-700 hover:bg-ink-50'
          )}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-b border-ink-100 bg-white px-4 py-4 shadow-lg lg:hidden">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-brand-50 hover:text-brand-700"
              >
                {link.label}
              </Link>
            ))}
            <Link href="/booking" className="btn-cta mt-2 justify-center">
              Book with us
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
