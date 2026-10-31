/** Link checks shared by the theme editors, events, hotels and other admin forms. */

/** Site path ("/packages", "#top"), mail/phone link, or a full http(s) URL. */
export function isValidLink(value: string): boolean {
  const v = value.trim();
  if (/\s/.test(v)) return false;
  if (v.startsWith('/') || v.startsWith('#')) return true;
  if (/^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(v)) return true;
  if (/^tel:\+?[\d-]{6,}$/i.test(v)) return true;
  return isValidUrl(v);
}

/** Full http(s) URL with a real-looking host. */
export function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.');
  } catch {
    return false;
  }
}
