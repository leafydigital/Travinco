'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X, ChevronDown, User, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { fastCustomerLogOut } from '@/lib/supabase/customer-signout';
import { useTranslation } from '@/lib/i18n/use-translation';
import type { NavbarContent } from '@/lib/navbar-footer-content-types';
import { DEFAULT_NAVBAR_FOOTER_CONTENT } from '@/lib/navbar-footer-content-types';

type Destination = { id: string; name: string; slug: string };

/**
 * Transparent-over-hero on the homepage (sits on top of the hero image
 * until you scroll), solid white on every other page where there's no
 * dark hero behind it.
 */
function normalizePathOrUrl(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('#')
  ) {
    return trimmed;
  }
  return '/' + trimmed;
}

export function SiteHeader({
  whatsappNumber,
  destinations,
  customerName: initialCustomerName,
  navbarContent,
}: {
  whatsappNumber?: string;
  destinations: Destination[];
  customerName?: string | null;
  navbarContent?: NavbarContent;
}) {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [destinationsOpen, setDestinationsOpen] = useState(false);
  const { t } = useTranslation();
  const [mobileDestinationsOpen, setMobileDestinationsOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  // The public layout is cached and shared by all visitors, so the signed-in
  // customer's name is loaded in the browser (re-checked on each route change
  // so login/logout is reflected without a full reload).
  const [customerName, setCustomerName] = useState<string | null>(initialCustomerName ?? null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/customer/me', { cache: 'no-store', credentials: 'same-origin', signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { name?: string | null } | null) => {
        if (data) setCustomerName(data.name ?? null);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [pathname]);

  const effectiveNavbar = navbarContent || DEFAULT_NAVBAR_FOOTER_CONTENT.navbar;
  const darkLogo = normalizePathOrUrl(effectiveNavbar.logo_image_url) || '/images/green_logo.png';
  const lightLogo = normalizePathOrUrl(effectiveNavbar.logo_light_image_url) || '/images/white_logo.png';
  const navLinksList = (
    (effectiveNavbar.nav_links && effectiveNavbar.nav_links.length > 0)
      ? effectiveNavbar.nav_links.filter((l) => l.visible !== false)
      : DEFAULT_NAVBAR_FOOTER_CONTENT.navbar.nav_links
  )
    // Destinations is no longer a navbar item (destinations lead to filtered packages instead)
    .filter((l) => l.key !== 'destinations' && normalizePathOrUrl(l.href) !== '/destinations');
  const showCta = !!effectiveNavbar.cta_button_text;
  const ctaText = effectiveNavbar.cta_button_text || t('nav_book_with_us');
  const ctaHref = normalizePathOrUrl(effectiveNavbar.cta_button_url) || '/booking';

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
  const logoImage = overlayMode ? lightLogo : darkLogo;

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
          className="flex items-center transition-opacity hover:opacity-90 py-1"
        >
          <div className="relative h-10 sm:h-11 max-w-[220px] flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoImage}
              alt={effectiveNavbar.logo_text || 'Travinco'}
              className="max-h-10 sm:max-h-11 w-auto object-contain"
            />
          </div>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {navLinksList.map((link) => {
            const linkHref = normalizePathOrUrl(link.href) || '/';
            const isDestinations = link.key === 'destinations' || linkHref === '/destinations';
            if (isDestinations) {
              return (
                <div
                  key={link.key || link.href}
                  className="relative"
                  onMouseEnter={() => setDestinationsOpen(true)}
                  onMouseLeave={() => setDestinationsOpen(false)}
                >
                  <button
                    type="button"
                    onClick={() => setDestinationsOpen((o) => !o)}
                    className={cn(
                      'flex items-center gap-1 text-sm font-medium transition-colors cursor-pointer',
                      overlayMode ? 'text-white/90 hover:text-white' : 'text-ink-600 hover:text-brand-700'
                    )}
                  >
                    {link.label}
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', destinationsOpen && 'rotate-180')} />
                  </button>

                  {destinationsOpen && (
                    <div className="absolute left-1/2 top-full z-10 w-64 -translate-x-1/2 pt-2">
                      <div className="rounded-xl2 border border-ink-100 bg-white p-2 shadow-lg">
                        <Link
                          href={linkHref}
                          onClick={() => setDestinationsOpen(false)}
                          className="block rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                        >
                          {t('nav_view_all_destinations')}
                        </Link>
                        {destinations.length > 0 && <div className="my-1 border-t border-ink-100" />}
                        <div className="grid max-h-72 grid-cols-1 gap-0.5 overflow-y-auto">
                          {destinations.slice(0, 3).map((d) => (
                            <Link
                              key={d.id}
                              href={`/destinations/${d.slug}`}
                              onClick={() => setDestinationsOpen(false)}
                              className="rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-ink-50 hover:text-brand-700"
                            >
                              {d.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={link.key || link.href}
                href={linkHref}
                className={cn(
                  'text-sm font-medium transition-colors',
                  overlayMode ? 'text-white/90 hover:text-white' : 'text-ink-600 hover:text-brand-700'
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {customerName ? (
            <div
              className="relative"
              onMouseEnter={() => setAccountMenuOpen(true)}
              onMouseLeave={() => setAccountMenuOpen(false)}
            >
              <button
                type="button"
                onClick={() => setAccountMenuOpen((o) => !o)}
                className={cn(
                  'flex items-center gap-2 text-sm font-medium transition-colors',
                  overlayMode ? 'text-white/90 hover:text-white' : 'text-ink-600 hover:text-brand-700'
                )}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                  {customerName.charAt(0).toUpperCase()}
                </span>
                {customerName}
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', accountMenuOpen && 'rotate-180')} />
              </button>
              {accountMenuOpen && (
                <div className="absolute right-0 top-full z-10 w-44 pt-2">
                  <div className="rounded-xl2 border border-ink-100 bg-white p-1.5 shadow-lg">
                    <Link
                      href="/account/bookings"
                      onClick={() => setAccountMenuOpen(false)}
                      className="block rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
                    >
                      {t('nav_my_bookings')}
                    </Link>
                    <Link
                      href="/account/change-password"
                      onClick={() => setAccountMenuOpen(false)}
                      className="block rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
                    >
                      {t('nav_change_password')}
                    </Link>
                    <div className="my-1 border-t border-ink-100" />
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        fastCustomerLogOut();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-coral-600 hover:bg-coral-50"
                    >
                      <LogOut className="h-3.5 w-3.5" /> {t('nav_log_out')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/account/login"
              className={cn(
                'flex items-center gap-1.5 text-sm font-medium transition-colors',
                overlayMode ? 'text-white/90 hover:text-white' : 'text-ink-600 hover:text-brand-700'
              )}
            >
              <User className="h-4 w-4" /> {t('nav_login')}
            </Link>
          )}
          {showCta && (
            <Link
              href={ctaHref}
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('travinco:reset-booking-form'));
                }
              }}
              className="btn-cta"
            >
              {ctaText}
            </Link>
          )}
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
            {navLinksList.map((link) => {
              const linkHref = normalizePathOrUrl(link.href) || '/';
              const isDestinations = link.key === 'destinations' || linkHref === '/destinations';
              if (isDestinations) {
                return (
                  <div key={link.key || link.href}>
                    <button
                      type="button"
                      onClick={() => setMobileDestinationsOpen((o) => !o)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-brand-50 hover:text-brand-700"
                    >
                      {link.label}
                      <ChevronDown
                        className={cn('h-4 w-4 transition-transform', mobileDestinationsOpen && 'rotate-180')}
                      />
                    </button>
                    {mobileDestinationsOpen && (
                      <div className="ml-3 mt-1 flex flex-col gap-0.5 border-l border-ink-100 pl-3">
                        <Link
                          href={linkHref}
                          onClick={() => setMobileOpen(false)}
                          className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-700"
                        >
                          {t('nav_view_all_destinations')}
                        </Link>
                        {destinations.slice(0, 3).map((d) => (
                          <Link
                            key={d.id}
                            href={`/destinations/${d.slug}`}
                            onClick={() => setMobileOpen(false)}
                            className="rounded-lg px-3 py-2 text-sm text-ink-600"
                          >
                            {d.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={link.key || link.href}
                  href={linkHref}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-brand-50 hover:text-brand-700"
                >
                  {link.label}
                </Link>
              );
            })}
            {customerName ? (
              <>
                <Link
                  href="/account/bookings"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-brand-50 hover:text-brand-700"
                >
                  <User className="h-4 w-4" /> {t('nav_my_bookings')}
                </Link>
                <Link
                  href="/account/change-password"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-brand-50 hover:text-brand-700"
                >
                  {t('nav_change_password')}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    fastCustomerLogOut();
                  }}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-coral-600 hover:bg-coral-50"
                >
                  <LogOut className="h-4 w-4" /> {t('nav_log_out')}
                </button>
              </>
            ) : (
              <Link
                href="/account/login"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-brand-50 hover:text-brand-700"
              >
                <User className="h-4 w-4" /> {t('nav_login')}
              </Link>
            )}
            {showCta && (
              <Link
                href={ctaHref}
                onClick={() => {
                  setMobileOpen(false);
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('travinco:reset-booking-form'));
                  }
                }}
                className="btn-cta mt-2 justify-center"
              >
                {ctaText}
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
