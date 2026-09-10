import Link from 'next/link';
import { Phone, Mail, MapPin } from 'lucide-react';

type FooterSettings = {
  business_name?: string;
  phone?: string;
  email?: string;
  address?: string;
};

export function SiteFooter({ settings }: { settings?: FooterSettings }) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-ink-100 bg-ink-900 text-ink-200">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-lg font-semibold text-white">
            {settings?.business_name ?? 'Wayfarer Trails'}
          </p>
          <p className="mt-3 text-sm text-ink-300">
            Handpicked holidays and end-to-end trip planning, built around how you actually
            like to travel.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Explore</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-300">
            <li><Link href="/packages" className="hover:text-white">Packages</Link></li>
            <li><Link href="/destinations" className="hover:text-white">Destinations</Link></li>
            <li><Link href="/offers" className="hover:text-white">Offers</Link></li>
            <li><Link href="/gallery" className="hover:text-white">Gallery</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Company</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-300">
            <li><Link href="/about" className="hover:text-white">About us</Link></li>
            <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
            <li><Link href="/booking" className="hover:text-white">Plan a trip</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Get in touch</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-300">
            {settings?.phone && (
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" /> {settings.phone}
              </li>
            )}
            {settings?.email && (
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" /> {settings.email}
              </li>
            )}
            {settings?.address && (
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5" /> {settings.address}
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-800 py-5 text-center text-xs text-ink-400">
        © {year} {settings?.business_name ?? 'Wayfarer Trails'}. All rights reserved.
      </div>
    </footer>
  );
}
