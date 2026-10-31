/** Click-to-contact links for the public site (footer, contact page). */

/** tel: link that dials the number on phones (keeps a leading +, drops spaces/dashes). */
export function telHref(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  return `tel:${trimmed.startsWith('+') ? '+' : ''}${digits}`;
}

/** mailto: link that opens the visitor's email app. */
export function mailHref(email: string): string {
  return `mailto:${email.trim()}`;
}

/** WhatsApp chat link (wa.me needs the number with country code, digits only). */
export function whatsappHref(number: string): string {
  return `https://wa.me/${number.replace(/\D/g, '')}`;
}

/** Google Maps search for an address (opens the Maps app on phones). */
export function mapsHref(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}
