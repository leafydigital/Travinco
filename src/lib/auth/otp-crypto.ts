import crypto from 'crypto';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/** Generates a secure 6-digit numeric OTP string */
export function generateOtpCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

function getEncryptionKey(): Buffer {
  const secret =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'travinco-auth-fallback-secret-key-32b';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptTicket(payload: object): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const jsonStr = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(jsonStr, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptTicket<T>(ticket: string): T | null {
  try {
    const [ivB64, tagB64, encB64] = ticket.split('.');
    if (!ivB64 || !tagB64 || !encB64) return null;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    const encrypted = Buffer.from(encB64, 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8')) as T;
  } catch {
    return null;
  }
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return email;
  if (user.length <= 2) return `${user[0]}*@${domain}`;
  const visible = user.slice(0, 2);
  return `${visible}${'*'.repeat(Math.min(user.length - 2, 5))}@${domain}`;
}
