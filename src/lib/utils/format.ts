export function formatCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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
