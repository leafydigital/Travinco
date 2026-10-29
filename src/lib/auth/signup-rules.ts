/**
 * Shared signup field rules (used by the signup form AND the server so they never disagree).
 */

/** Standard email pattern: local@domain.tld (any domain). */
export const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

export function validateEmailFormat(email: string): string | null {
  const v = email.trim();
  if (!v) return 'Email address is required';
  if (!EMAIL_REGEX.test(v)) return 'Enter a valid email address (e.g. name@example.com)';
  return null;
}

/** Usernames may contain any characters except whitespace. */
export function validateUsernameFormat(username: string): string | null {
  const v = username.trim();
  if (!v) return 'Username is required';
  if (/\s/.test(username)) return 'Username cannot contain spaces';
  if (v.length < USERNAME_MIN) return `Username must be at least ${USERNAME_MIN} characters`;
  if (v.length > USERNAME_MAX) return `Username must be at most ${USERNAME_MAX} characters`;
  return null;
}

/**
 * Escapes LIKE/ILIKE wildcards (% _ \) so user-supplied text (e.g. usernames, which may
 * now contain any non-space character) is matched literally in `.ilike()` queries.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}
