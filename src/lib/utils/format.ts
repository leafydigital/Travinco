/** Symbols for currencies whose Intl narrow symbol is ambiguous ($) or missing. */
const CURRENCY_SYMBOL_OVERRIDES: Record<string, string> = {
  SGD: 'S$',
  AUD: 'A$',
  CAD: 'C$',
  NZD: 'NZ$',
  HKD: 'HK$',
  AED: 'د.إ',
  SAR: '﷼',
  QAR: 'QR',
  OMR: 'OMR',
  KWD: 'KD',
  BHD: 'BD',
};

/** The display symbol for a currency code, e.g. INR → ₹, USD → $, EUR → €. */
export function currencySymbol(currency = 'INR') {
  const code = (currency || 'INR').toUpperCase();
  if (CURRENCY_SYMBOL_OVERRIDES[code]) return CURRENCY_SYMBOL_OVERRIDES[code];
  try {
    const part = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    })
      .formatToParts(0)
      .find((p) => p.type === 'currency');
    return part?.value ?? code;
  } catch {
    return code;
  }
}

/** Formats an amount with the currency's symbol (₹12,345 / $12,345 / €12,345). */
export function formatCurrency(amount: number, currency = 'INR') {
  const code = (currency || 'INR').toUpperCase();
  let number: string;
  try {
    number = new Intl.NumberFormat(code === 'INR' ? 'en-IN' : 'en-US', {
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);
  } catch {
    number = String(amount);
  }
  const symbol = currencySymbol(code);
  // Letter-based symbols read better with a space (e.g. "RM 1,200", "QR 500")
  return /^[A-Za-z]/.test(symbol) && !/\$$/.test(symbol) ? `${symbol} ${number}` : `${symbol}${number}`;
}

/**
 * Business timezone. Dates/times are rendered in IST everywhere — otherwise
 * server-rendered pages show UTC times (the server's zone), 5h30m off.
 */
export const APP_TIME_ZONE = 'Asia/Kolkata';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    // Plain YYYY-MM-DD values are calendar dates (parsed as UTC midnight) — don't shift them
    timeZone: typeof value === 'string' && DATE_ONLY.test(value) ? 'UTC' : APP_TIME_ZONE,
  }).format(date);
}

export function formatTime(value: string | Date | null | undefined) {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: APP_TIME_ZONE,
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: APP_TIME_ZONE,
  }).format(date);
}

/** Turns a snake_case enum value into a readable label, e.g. 'follow_up' -> 'Follow up'. */
export function toLabel(value: string) {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Converts a normal YouTube or Vimeo watch/share URL into an embeddable
 * player URL, so the video plays inline via an <iframe> instead of the
 * visitor being sent to youtube.com/vimeo.com. Returns null for anything
 * else, so callers can skip rendering a player rather than embed a
 * broken/untrusted URL.
 */
export function getVideoEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');

    // YouTube does not expose any URL parameter that reliably hides its
    // own title/channel overlay or replaces its native controls — that
    // UI is enforced by YouTube's player itself, not something this app
    // can turn off. The embed URL is passed through unmodified rather
    // than relying on deprecated flags (modestbranding, showinfo) that
    // don't actually achieve that and would just be a fake fix.
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = parsed.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === 'youtube.com' && parsed.pathname.startsWith('/embed/')) {
      return url;
    }
    // Vimeo's embed does support fully hiding the channel name/avatar.
    if (host === 'vimeo.com') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id && /^\d+$/.test(id)
        ? `https://player.vimeo.com/video/${id}?title=0&byline=0&portrait=0`
        : null;
    }
    if (host === 'player.vimeo.com') {
      return url.includes('?') ? `${url}&title=0&byline=0&portrait=0` : `${url}?title=0&byline=0&portrait=0`;
    }
    return null;
  } catch {
    return null;
  }
}
