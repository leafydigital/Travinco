import Link from 'next/link';
import { Phone, Mail, MapPin, Facebook, Instagram, Twitter } from 'lucide-react';

type FooterSettings = {
  business_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  social?: { facebook?: string; instagram?: string; twitter?: string };
};

export function SiteFooter({ settings }: { settings?: FooterSettings }) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t-2 border-coral-500 bg-navy-900 text-white/70">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-lg font-semibold text-white">
            {settings?.business_name ?? 'Travinco'}
          </p>
          <p className="mt-3 text-sm text-white/60">
            Handpicked holidays and end-to-end trip planning, built around how you actually
            like to travel.
          </p>
          {(settings?.social?.facebook || settings?.social?.instagram || settings?.social?.twitter) && (
            <div className="mt-4 flex gap-3">
              {settings?.social?.facebook && (
                <a
                  href={settings.social.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-white/10 p-2 text-white/70 hover:bg-brand-600 hover:text-white"
                  aria-label="Facebook"
                >
                  <Facebook className="h-4 w-4" />
                </a>
              )}
              {settings?.social?.instagram && (
                <a
                  href={settings.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-white/10 p-2 text-white/70 hover:bg-brand-600 hover:text-white"
                  aria-label="Instagram"
                >
                  <Instagram className="h-4 w-4" />
                </a>
              )}
              {settings?.social?.twitter && (
                <a
                  href={settings.social.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-white/10 p-2 text-white/70 hover:bg-brand-600 hover:text-white"
                  aria-label="Twitter / X"
                >
                  <Twitter className="h-4 w-4" />
                </a>
              )}
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Explore</p>
          <ul className="mt-3 space-y-2 text-sm text-white/60">
            <li><Link href="/packages" className="transition-colors hover:text-ocean-300">Packages</Link></li>
            <li><Link href="/destinations" className="transition-colors hover:text-ocean-300">Destinations</Link></li>
            <li><Link href="/offers" className="transition-colors hover:text-ocean-300">Offers</Link></li>
            <li><Link href="/gallery" className="transition-colors hover:text-ocean-300">Gallery</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Company</p>
          <ul className="mt-3 space-y-2 text-sm text-white/60">
            <li><Link href="/about" className="transition-colors hover:text-ocean-300">About us</Link></li>
            <li><Link href="/contact" className="transition-colors hover:text-ocean-300">Contact</Link></li>
            <li><Link href="/booking" className="transition-colors hover:text-ocean-300">Plan a trip</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Get in touch</p>
          <ul className="mt-3 space-y-2 text-sm text-white/60">
            {settings?.phone && (
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-coral-400" /> {settings.phone}
              </li>
            )}
            {settings?.email && (
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-coral-400" /> {settings.email}
              </li>
            )}
            {settings?.address && (
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-coral-400" /> {settings.address}
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 bg-navy-900/60 py-5 text-center text-xs text-white/50">
        © {year} {settings?.business_name ?? 'Travinco'}. All rights reserved.
      </div>
    </footer>
  );
}
