import Link from 'next/link';
import { MessageCircle, Menu } from 'lucide-react';

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

export function SiteHeader({ whatsappNumber }: { whatsappNumber?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" className="font-display text-lg font-semibold text-brand-700">
          Wayfarer Trails
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink-600 hover:text-brand-700"
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
              className="btn-outline"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          )}
          <Link href="/booking" className="btn-primary">
            Book now
          </Link>
        </div>

        <details className="lg:hidden">
          <summary className="list-none rounded-lg p-2 hover:bg-ink-50">
            <Menu className="h-5 w-5 text-ink-700" />
          </summary>
          <div className="absolute inset-x-0 top-16 border-b border-ink-100 bg-white px-4 py-4 shadow-lg">
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
                >
                  {link.label}
                </Link>
              ))}
              <Link href="/booking" className="btn-primary mt-2 justify-center">
                Book now
              </Link>
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}
