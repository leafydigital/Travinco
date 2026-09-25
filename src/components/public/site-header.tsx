'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MessageCircle, Menu, X, ChevronDown, User, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { logOutCustomer as headerLogOutCustomer } from '@/app/(public)/account/actions';
import { LanguagePicker } from './language-picker';
import { useTranslation } from '@/lib/i18n/use-translation';

type Destination = { id: string; name: string; slug: string };

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/packages', label: 'Packages' },
  { href: '/offers', label: 'Offers' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

/**
 * Transparent-over-hero on the homepage (sits on top of the hero image
 * until you scroll), solid white on every other page where there's no
 * dark hero behind it.
 */
export function SiteHeader({
  whatsappNumber,
  destinations,
  customerName,
}: {
  whatsappNumber?: string;
  destinations: Destination[];
  customerName?: string | null;
}) {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [destinationsOpen, setDestinationsOpen] = useState(false);
  const { t } = useTranslation();
  const [mobileDestinationsOpen, setMobileDestinationsOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

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
          <Link
            href="/"
            className={cn(
              'text-sm font-medium transition-colors',
              overlayMode ? 'text-white/90 hover:text-white' : 'text-ink-600 hover:text-brand-700'
            )}
          >
            {t('nav_home')}
          </Link>
          <Link
            href="/packages"
            className={cn(
              'text-sm font-medium transition-colors',
              overlayMode ? 'text-white/90 hover:text-white' : 'text-ink-600 hover:text-brand-700'
            )}
          >
            {t('nav_packages')}
          </Link>

          {/* Destinations: opens on hover (desktop mouse) and on touch/click
              (mobile, or a mouse click) — never requires a click on desktop.
              Clicking/tapping the "Destinations" label itself still
              navigates to the full destinations listing page. */}
          <div
            className="relative"
            onMouseEnter={() => setDestinationsOpen(true)}
            onMouseLeave={() => setDestinationsOpen(false)}
          >
            <button
              type="button"
              onClick={() => setDestinationsOpen((o) => !o)}
              className={cn(
                'flex items-center gap-1 text-sm font-medium transition-colors',
                overlayMode ? 'text-white/90 hover:text-white' : 'text-ink-600 hover:text-brand-700'
              )}
            >
              {t('nav_destinations')}
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', destinationsOpen && 'rotate-180')} />
            </button>

            {destinationsOpen && (
              <div className="absolute left-1/2 top-full z-10 w-64 -translate-x-1/2 pt-2">
                <div className="rounded-xl2 border border-ink-100 bg-white p-2 shadow-lg">
                  <Link
                    href="/destinations"
                    onClick={() => setDestinationsOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                  >
                    {t('nav_view_all_destinations')}
                  </Link>
                  {destinations.length > 0 && <div className="my-1 border-t border-ink-100" />}
                  <div className="grid max-h-72 grid-cols-1 gap-0.5 overflow-y-auto">
                    {destinations.map((d) => (
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

          <Link
            href="/offers"
            className={cn(
              'text-sm font-medium transition-colors',
              overlayMode ? 'text-white/90 hover:text-white' : 'text-ink-600 hover:text-brand-700'
            )}
          >
            {t('nav_offers')}
          </Link>
          <Link
            href="/gallery"
            className={cn(
              'text-sm font-medium transition-colors',
              overlayMode ? 'text-white/90 hover:text-white' : 'text-ink-600 hover:text-brand-700'
            )}
          >
            {t('nav_gallery')}
          </Link>
          <Link
            href="/blog"
            className={cn(
              'text-sm font-medium transition-colors',
              overlayMode ? 'text-white/90 hover:text-white' : 'text-ink-600 hover:text-brand-700'
            )}
          >
            {t('nav_blog')}
          </Link>
          <Link
            href="/about"
            className={cn(
              'text-sm font-medium transition-colors',
              overlayMode ? 'text-white/90 hover:text-white' : 'text-ink-600 hover:text-brand-700'
            )}
          >
            {t('nav_about')}
          </Link>
          <Link
            href="/contact"
            className={cn(
              'text-sm font-medium transition-colors',
              overlayMode ? 'text-white/90 hover:text-white' : 'text-ink-600 hover:text-brand-700'
            )}
          >
            {t('nav_contact')}
          </Link>
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
                        headerLogOutCustomer();
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
          <LanguagePicker overlayMode={overlayMode} />
          <Link href="/booking" className="btn-cta">
            {t('nav_book_with_us')}
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
            {navLinks.slice(0, 2).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-brand-50 hover:text-brand-700"
              >
                {link.label}
              </Link>
            ))}

            <div>
              <button
                type="button"
                onClick={() => setMobileDestinationsOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-brand-50 hover:text-brand-700"
              >
                {t('nav_destinations')}
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', mobileDestinationsOpen && 'rotate-180')}
                />
              </button>
              {mobileDestinationsOpen && (
                <div className="ml-3 mt-1 flex flex-col gap-0.5 border-l border-ink-100 pl-3">
                  <Link
                    href="/destinations"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-700"
                  >
                    {t('nav_view_all_destinations')}
                  </Link>
                  {destinations.map((d) => (
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

            {navLinks.slice(2).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-brand-50 hover:text-brand-700"
              >
                {link.label}
              </Link>
            ))}
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
                    headerLogOutCustomer();
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
            <Link href="/booking" className="btn-cta mt-2 justify-center">
              {t('nav_book_with_us')}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
