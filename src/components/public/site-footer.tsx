import Link from 'next/link';
import { Phone, Mail, MapPin, Facebook, Instagram, Twitter, Linkedin, Youtube } from 'lucide-react';
import type { FooterContent } from '@/lib/navbar-footer-content-types';
import { DEFAULT_NAVBAR_FOOTER_CONTENT } from '@/lib/navbar-footer-content-types';

type FooterSettings = {
  business_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  social?: { facebook?: string; instagram?: string; twitter?: string };
};

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

export function SiteFooter({
  settings,
  footerContent,
}: {
  settings?: FooterSettings;
  footerContent?: FooterContent;
}) {
  const year = new Date().getFullYear();

  const brandName = footerContent?.brand_name || settings?.business_name || 'Travinco';
  const tagline =
    footerContent?.brand_tagline ||
    'Handpicked holidays and end-to-end trip planning, built around how you actually like to travel.';

  const exploreTitle = footerContent?.explore_heading || 'Explore';
  const exploreLinks =
    footerContent?.explore_links && footerContent.explore_links.length > 0
      ? footerContent.explore_links
      : DEFAULT_NAVBAR_FOOTER_CONTENT.footer.explore_links;

  const companyTitle = footerContent?.company_heading || 'Company';
  const companyLinks =
    footerContent?.company_links && footerContent.company_links.length > 0
      ? footerContent.company_links
      : DEFAULT_NAVBAR_FOOTER_CONTENT.footer.company_links;

  const contactTitle = footerContent?.contact_heading || 'Get in touch';
  const phone = footerContent?.phone || settings?.phone || '';
  const email = footerContent?.email || settings?.email || '';
  const address = footerContent?.address || settings?.address || '';

  const showSocial = footerContent?.show_social !== false;
  const facebook = footerContent?.social?.facebook || settings?.social?.facebook || '';
  const instagram = footerContent?.social?.instagram || settings?.social?.instagram || '';
  const twitter = footerContent?.social?.twitter || settings?.social?.twitter || '';
  const linkedin = footerContent?.social?.linkedin || '';
  const youtube = footerContent?.social?.youtube || '';

  const copyrightText = footerContent?.copyright_text || 'All rights reserved.';

  return (
    <footer className="border-t-2 border-emerald-500 bg-navy-900 text-white/70">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-lg font-semibold text-white">
            {brandName}
          </p>
          <p className="mt-3 text-sm text-white/60">
            {tagline}
          </p>
          {showSocial && (
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={facebook || '#'}
                target={facebook ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="rounded-full bg-white/10 p-2 text-white/70 hover:bg-brand-600 hover:text-white transition"
                aria-label="Facebook"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href={instagram || '#'}
                target={instagram ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="rounded-full bg-white/10 p-2 text-white/70 hover:bg-brand-600 hover:text-white transition"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href={twitter || '#'}
                target={twitter ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="rounded-full bg-white/10 p-2 text-white/70 hover:bg-brand-600 hover:text-white transition"
                aria-label="Twitter / X"
              >
                <Twitter className="h-4 w-4" />
              </a>
              {linkedin && (
                <a
                  href={linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-white/10 p-2 text-white/70 hover:bg-brand-600 hover:text-white transition"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="h-4 w-4" />
                </a>
              )}
              {youtube && (
                <a
                  href={youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-white/10 p-2 text-white/70 hover:bg-brand-600 hover:text-white transition"
                  aria-label="YouTube"
                >
                  <Youtube className="h-4 w-4" />
                </a>
              )}
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-semibold text-white">{exploreTitle}</p>
          <ul className="mt-3 space-y-2 text-sm text-white/60">
            {exploreLinks.map((item) => (
              <li key={item.id || item.href}>
                <Link href={normalizePathOrUrl(item.href) || '/'} className="transition-colors hover:text-ocean-300">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">{companyTitle}</p>
          <ul className="mt-3 space-y-2 text-sm text-white/60">
            {companyLinks.map((item) => (
              <li key={item.id || item.href}>
                <Link href={normalizePathOrUrl(item.href) || '/'} className="transition-colors hover:text-ocean-300">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">{contactTitle}</p>
          <ul className="mt-3 space-y-2 text-sm text-white/60">
            {phone && (
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-emerald-400" /> {phone}
              </li>
            )}
            {email && (
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-emerald-400" /> {email}
              </li>
            )}
            {address && (
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" /> {address}
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 bg-navy-900/60 py-5 text-center text-xs text-white/50">
        © {year} {brandName}. {copyrightText}
      </div>
    </footer>
  );
}
