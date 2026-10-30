/**
 * Display helpers for enquiries.
 *
 * Contact-page messages are stored as "[Contact form — <subject>] <message>" so
 * staff can tell them apart; in the dashboard we show only the customer's text.
 */

const CONTACT_PREFIX = /^\s*\[Contact form(?:\s+—\s+([^\]\n]*))?\]\s*/;

export function splitEnquiryMessage(message: string | null | undefined): {
  prefix: string;
  body: string;
  isContactForm: boolean;
  /** Subject typed on the Contact page ('' when none was given) */
  subject: string;
} {
  const text = message ?? '';
  const match = text.match(CONTACT_PREFIX);
  if (!match) return { prefix: '', body: text.trim(), isContactForm: false, subject: '' };
  return {
    prefix: match[0].trim(),
    body: text.slice(match[0].length).trim(),
    isContactForm: true,
    subject: (match[1] ?? '').trim(),
  };
}

const SOURCE_LABELS: Record<string, string> = {
  website: 'Website',
  whatsapp: 'WhatsApp',
  phone: 'Phone',
  walk_in: 'Walk in',
  referral: 'Referral',
  social_media: 'Social media',
  excel_import: 'Excel upload',
  other: 'Other',
};

/** Contact-page enquiries read "Other"; enquiries from the website's enquiry/booking forms read "Website". */
export function enquirySourceLabel(source: string | null | undefined, message?: string | null): string {
  if (splitEnquiryMessage(message).isContactForm) return 'Other';
  if (!source) return '—';
  return SOURCE_LABELS[source] ?? source.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
