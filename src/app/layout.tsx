import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { FormGuards } from '@/components/ui/form-guards';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Travinco';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

const defaultTitle = `${siteName} Kerala Tour Packages | Travel Agency in Trivandrum`;
const defaultDescription =
  'Travinco is a Govt. Registered travel agency in Trivandrum for custom Kerala, Kashmir, Andaman, India, Asia & popular international destinations.';
const shareImage = { url: '/images/green_logo.png', alt: `${siteName} — Travel Agency in Trivandrum` };

// Site-wide SEO defaults. Pages override title/description with their own metadata.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultTitle,
    template: `%s | ${siteName}`,
  },
  description: defaultDescription,
  applicationName: siteName,
  keywords: [
    'Kerala tour packages',
    'travel agency in Trivandrum',
    'Kerala holiday packages',
    'Kashmir tour packages',
    'Andaman tour packages',
    'international tour packages',
    'honeymoon packages Kerala',
    'Travinco',
  ],
  alternates: { canonical: './' },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  },
  openGraph: {
    type: 'website',
    siteName,
    locale: 'en_IN',
    url: './',
    images: [shareImage],
  },
  twitter: {
    card: 'summary_large_image',
    images: [shareImage.url],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}
        <Toaster richColors position="top-right" />
        <FormGuards />
      </body>
    </html>
  );
}
