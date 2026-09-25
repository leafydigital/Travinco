import { z } from 'zod';

/**
 * Hostnames that are never themselves an image file — they're a page
 * *about* an image (a share link, a search results page, a social
 * media post), which next/image can't render and which isn't
 * configured as an allowed image host on purpose, since allowing it
 * would mean trusting arbitrary pages on that domain as "images".
 * Pasting one of these instead of a direct image URL is a common
 * mistake (e.g. "Copy link" instead of "Copy image address").
 */
const REJECTED_IMAGE_HOSTS = [
  'share.google',
  'google.com',
  'www.google.com',
  'facebook.com',
  'www.facebook.com',
  'instagram.com',
  'www.instagram.com',
  'pinterest.com',
  'www.pinterest.com',
];

/**
 * A URL schema for image fields: must be a syntactically valid URL
 * AND not one of the known non-image hosts above. Use this in place of
 * a bare z.string().url() wherever a field is meant to hold a direct
 * image link, so a pasted share/search-page link is caught at save
 * time with a clear message, instead of only failing later when
 * next/image tries to render it on the live site.
 */
export const imageUrlSchema = z.string().refine(
  (value) => {
    if (!value) return true; // emptiness is handled by .optional()/.nullable() at the call site
    try {
      const parsed = new URL(value);
      const host = parsed.hostname.replace(/^www\./, '');
      return !REJECTED_IMAGE_HOSTS.some((rejected) => host === rejected.replace(/^www\./, ''));
    } catch {
      return false;
    }
  },
  {
    message:
      'This looks like a link to a page, not a direct image file. Right-click the actual image and choose "Copy image address", or upload the file directly.',
  }
);
