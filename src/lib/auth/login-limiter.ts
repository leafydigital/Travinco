import { randomUUID } from 'crypto';
import { cookies, headers } from 'next/headers';
import { sendGmail } from '@/lib/email/gmail';

/**
 * Failed-login limiter — scoped to the DEVICE, not the account.
 *
 * After too many wrong passwords, only the browser/device that made them is
 * blocked for 15 minutes. The real account owner can still sign in from their
 * own device, so a stranger guessing passwords can no longer lock them out.
 *
 * - Device identity: a random, httpOnly cookie (`tv_device_id`), created on the
 *   first failed attempt. Attempts are counted per device + account.
 * - Backstop: someone who keeps clearing cookies is still caught by a per-IP
 *   counter (per account) with a higher threshold.
 * - The account owner receives one security alert email per lockout period.
 *
 * Function names/signatures are unchanged, so existing callers keep working.
 */

export const MAX_ADMIN_LOGIN_ATTEMPTS = 5;
export const MAX_CUSTOMER_LOGIN_ATTEMPTS = 3;
export const MAX_LOGIN_ATTEMPTS = MAX_CUSTOMER_LOGIN_ATTEMPTS; // alias for backwards compatibility
export const LOCKOUT_DURATION_MINUTES = 15;
export const LOCKOUT_DURATION_MS = LOCKOUT_DURATION_MINUTES * 60 * 1000;
/** Per-IP backstop (per account) for clients that drop the device cookie. */
const MAX_ATTEMPTS_PER_IP = 20;

const DEVICE_COOKIE = 'tv_device_id';
const DEVICE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export interface LoginAttemptStatus {
  isLocked: boolean;
  limitReached: boolean;
  failedAttempts: number;
  remainingAttempts: number;
  minutesRemaining?: number;
  lockedUntil?: Date | null;
}

interface AttemptRecord {
  failedAttempts: number;
  lockedUntil: number | null;
  lastFailedAt: number;
}

type Portal = 'admin' | 'customer';

// In-memory store shared across requests in the server process
declare global {
  // eslint-disable-next-line no-var
  var __travincoLoginAttemptsStore: Map<string, AttemptRecord> | undefined;
  // eslint-disable-next-line no-var
  var __travincoLimitEmailSentAt: Map<string, number> | undefined;
}

function getMemoryStore(): Map<string, AttemptRecord> {
  if (!globalThis.__travincoLoginAttemptsStore) globalThis.__travincoLoginAttemptsStore = new Map();
  return globalThis.__travincoLoginAttemptsStore;
}

function getEmailSentStore(): Map<string, number> {
  if (!globalThis.__travincoLimitEmailSentAt) globalThis.__travincoLimitEmailSentAt = new Map();
  return globalThis.__travincoLimitEmailSentAt;
}

function maxAttemptsFor(portal: Portal) {
  return portal === 'customer' ? MAX_CUSTOMER_LOGIN_ATTEMPTS : MAX_ADMIN_LOGIN_ATTEMPTS;
}

function normalize(value: string) {
  return (value || '').trim().toLowerCase();
}

/** Reads the device id cookie; optionally creates it (only possible in Server Actions / Route Handlers). */
function getDeviceId(create: boolean): string | null {
  try {
    const store = cookies();
    const existing = store.get(DEVICE_COOKIE)?.value;
    if (existing && /^[a-f0-9-]{36}$/i.test(existing)) return existing;
    if (!create) return null;
    const id = randomUUID();
    store.set(DEVICE_COOKIE, id, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: DEVICE_COOKIE_MAX_AGE,
    });
    return id;
  } catch {
    return null;
  }
}

function getClientIp(): string {
  try {
    const h = headers();
    return (
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      h.get('x-real-ip') ||
      'unknown'
    );
  } catch {
    return 'unknown';
  }
}

// Device state is also kept in an httpOnly cookie on the device itself, so the block
// survives across server instances (serverless memory isn't shared between them).
function guardCookieName(portal: Portal) {
  return `tv_login_guard_${portal}`;
}

function readGuardCookie(portal: Portal, email: string): AttemptRecord | null {
  try {
    const raw = cookies().get(guardCookieName(portal))?.value;
    if (!raw) return null;
    const data = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    if (data?.email !== email) return null;
    return {
      failedAttempts: Number(data.attempts) || 0,
      lockedUntil: data.lockedUntil ? Number(data.lockedUntil) : null,
      lastFailedAt: Number(data.lastFailedAt) || Date.now(),
    };
  } catch {
    return null;
  }
}

function writeGuardCookie(portal: Portal, email: string, record: AttemptRecord | null) {
  try {
    const store = cookies();
    const name = guardCookieName(portal);
    if (!record) {
      store.set(name, '', { path: '/', maxAge: 0 });
      return;
    }
    const value = Buffer.from(
      JSON.stringify({
        email,
        attempts: record.failedAttempts,
        lockedUntil: record.lockedUntil,
        lastFailedAt: record.lastFailedAt,
      }),
      'utf-8'
    ).toString('base64');
    store.set(name, value, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: Math.ceil(LOCKOUT_DURATION_MS / 1000),
    });
  } catch {
    // Not writable in this context (e.g. Server Component render) — memory still applies
  }
}

/** Device record = the more restrictive of memory and the device's own cookie. */
function readDeviceRecord(portal: Portal, email: string, deviceId: string | null): AttemptRecord | null {
  const fromMemory = deviceId ? readRecord(deviceKey(portal, email, deviceId)) : null;
  let fromCookie = readGuardCookie(portal, email);
  if (fromCookie) {
    const now = Date.now();
    const expired =
      (fromCookie.lockedUntil && fromCookie.lockedUntil <= now) ||
      (!fromCookie.lockedUntil && now - fromCookie.lastFailedAt > LOCKOUT_DURATION_MS);
    if (expired) fromCookie = null;
  }
  if (!fromMemory) return fromCookie;
  if (!fromCookie) return fromMemory;
  return {
    failedAttempts: Math.max(fromMemory.failedAttempts, fromCookie.failedAttempts),
    lockedUntil: Math.max(fromMemory.lockedUntil ?? 0, fromCookie.lockedUntil ?? 0) || null,
    lastFailedAt: Math.max(fromMemory.lastFailedAt, fromCookie.lastFailedAt),
  };
}

function deviceKey(portal: Portal, email: string, deviceId: string) {
  return `${portal}:device:${deviceId}:${email}`;
}
function ipKey(portal: Portal, email: string, ip: string) {
  return `${portal}:ip:${ip}:${email}`;
}

/** Returns the record with an expired lock reset (lock windows are 15 minutes). */
function readRecord(key: string): AttemptRecord | null {
  const store = getMemoryStore();
  const record = store.get(key);
  if (!record) return null;
  const now = Date.now();
  if (record.lockedUntil && record.lockedUntil <= now) {
    store.delete(key);
    return null;
  }
  // Forget stale failure streaks after the lockout window
  if (!record.lockedUntil && now - record.lastFailedAt > LOCKOUT_DURATION_MS) {
    store.delete(key);
    return null;
  }
  return record;
}

function lockedStatus(record: AttemptRecord): LoginAttemptStatus {
  const msLeft = Math.max(0, (record.lockedUntil ?? 0) - Date.now());
  return {
    isLocked: true,
    limitReached: true,
    failedAttempts: record.failedAttempts,
    remainingAttempts: 0,
    minutesRemaining: Math.max(1, Math.ceil(msLeft / 60000)),
    lockedUntil: record.lockedUntil ? new Date(record.lockedUntil) : null,
  };
}

/**
 * Sends the account owner a security alert when sign-in attempts were blocked on a device.
 */
export async function sendLoginLimitReachedEmail({
  email,
  fullName,
  portal = 'customer',
}: {
  email: string;
  fullName?: string;
  portal?: Portal;
}): Promise<void> {
  const normalizedEmail = normalize(email);
  const displayName = escapeHtml(fullName || normalizedEmail.split('@')[0] || 'there');
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://travinco.vercel.app').replace(/\/+$/, '');
  const resetUrl = `${siteUrl}/account/login?action=forgot_password&email=${encodeURIComponent(normalizedEmail)}`;
  const maxAttempts = maxAttemptsFor(portal);
  const when = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Security alert: unsuccessful sign-in attempts</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 24px; margin: 0;">
        <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden;">
          <div style="background-color: #022c22; padding: 28px 24px; text-align: center;">
            <h1 style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 700; letter-spacing: 1px;">TRAVINCO</h1>
            <p style="color: #a7f3d0; font-size: 13px; margin: 6px 0 0; text-transform: uppercase; letter-spacing: 1.5px;">Account Security Alert</p>
          </div>
          <div style="padding: 32px 28px; color: #334155; font-size: 14px; line-height: 1.7;">
            <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; font-weight: 600;">Dear ${displayName},</p>
            <p style="margin: 0 0 16px;">
              We detected <strong>${maxAttempts} consecutive unsuccessful sign-in attempts</strong> on your Travinco account
              (<strong>${normalizedEmail}</strong>) on ${when} IST.
            </p>
            <p style="margin: 0 0 16px;">
              As a security precaution, further sign-in attempts from <strong>that device</strong> have been paused for
              ${LOCKOUT_DURATION_MINUTES} minutes. <strong>Your account has not been locked</strong> — you can continue to sign in
              as usual from your own device with your correct password.
            </p>
            <div style="background-color: #f1f5f9; border-radius: 12px; padding: 16px 18px; margin: 0 0 20px;">
              <p style="margin: 0 0 6px; font-weight: 600; color: #0f172a;">If this was you</p>
              <p style="margin: 0;">No action is needed. If you have forgotten your password, you can reset it using the button below.</p>
            </div>
            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px 18px; margin: 0 0 24px;">
              <p style="margin: 0 0 6px; font-weight: 600; color: #991b1b;">If this wasn't you</p>
              <p style="margin: 0; color: #7f1d1d;">Someone may be trying to access your account. We recommend resetting your password now and not sharing it with anyone.</p>
            </div>
            <p style="margin: 0 0 24px; text-align: center;">
              <a href="${resetUrl}" style="display: inline-block; background-color: #047857; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 28px; border-radius: 10px;">Reset your password</a>
            </p>
            <p style="margin: 0 0 20px; font-size: 13px; color: #64748b;">
              Travinco will never ask you for your password by email, phone or message.
            </p>
            <p style="margin: 0;">Regards,<br><strong>Team Travinco</strong></p>
          </div>
          <div style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 16px 24px; text-align: center;">
            <p style="font-size: 11px; color: #94a3b8; margin: 0;">This is an automated security notification. &copy; ${new Date().getFullYear()} Travinco - Travel Solutions.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    await sendGmail({
      to: normalizedEmail,
      subject: 'Security alert: unsuccessful sign-in attempts on your Travinco account',
      html,
    });
  } catch (err) {
    console.warn('Failed to send login limit email:', err);
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Is THIS device (or, as a backstop, this IP) currently blocked for the given account?
 */
export async function checkLoginLockout(
  rawEmail: string,
  portal: Portal = 'customer'
): Promise<LoginAttemptStatus> {
  const email = normalize(rawEmail);
  const maxAllowed = maxAttemptsFor(portal);
  const notLocked: LoginAttemptStatus = {
    isLocked: false,
    limitReached: false,
    failedAttempts: 0,
    remainingAttempts: maxAllowed,
  };
  if (!email) return notLocked;

  const deviceId = getDeviceId(false);
  const deviceRecord = readDeviceRecord(portal, email, deviceId);
  if (deviceRecord?.lockedUntil) return lockedStatus(deviceRecord);

  const ipRecord = readRecord(ipKey(portal, email, getClientIp()));
  if (ipRecord?.lockedUntil) return lockedStatus(ipRecord);

  const failed = deviceRecord?.failedAttempts ?? 0;
  return {
    isLocked: false,
    limitReached: false,
    failedAttempts: failed,
    remainingAttempts: Math.max(0, maxAllowed - failed),
  };
}

/**
 * Records a failed attempt for this device (+ IP backstop). On reaching the limit the
 * device is blocked for 15 minutes and the account owner is emailed once.
 */
export async function recordFailedLoginAttempt(
  rawEmail: string,
  portal: Portal = 'customer',
  fullName?: string
): Promise<LoginAttemptStatus> {
  const email = normalize(rawEmail);
  const maxAllowed = maxAttemptsFor(portal);
  if (!email) {
    return { isLocked: false, limitReached: false, failedAttempts: 1, remainingAttempts: maxAllowed - 1 };
  }

  const store = getMemoryStore();
  const now = Date.now();

  // Device counter
  const deviceId = getDeviceId(true) ?? `ip-${getClientIp()}`;
  const dKey = deviceKey(portal, email, deviceId);
  const dPrev = readDeviceRecord(portal, email, deviceId);
  const dAttempts = (dPrev?.failedAttempts ?? 0) + 1;
  const dLocked = dAttempts >= maxAllowed;
  const dRecord: AttemptRecord = {
    failedAttempts: dAttempts,
    lockedUntil: dLocked ? now + LOCKOUT_DURATION_MS : null,
    lastFailedAt: now,
  };
  store.set(dKey, dRecord);
  writeGuardCookie(portal, email, dRecord);

  // IP backstop counter
  const iKey = ipKey(portal, email, getClientIp());
  const iPrev = readRecord(iKey);
  const iAttempts = (iPrev?.failedAttempts ?? 0) + 1;
  const iLocked = iAttempts >= MAX_ATTEMPTS_PER_IP;
  store.set(iKey, {
    failedAttempts: iAttempts,
    lockedUntil: iLocked ? now + LOCKOUT_DURATION_MS : null,
    lastFailedAt: now,
  });

  if (dLocked || iLocked) {
    // One alert email per account per lockout window
    const sentStore = getEmailSentStore();
    const sentKey = `${portal}:${email}`;
    const lastSent = sentStore.get(sentKey) ?? 0;
    if (now - lastSent > LOCKOUT_DURATION_MS) {
      sentStore.set(sentKey, now);
      await sendLoginLimitReachedEmail({ email, fullName, portal });
    }
    return lockedStatus(dLocked ? dRecord : (store.get(iKey) as AttemptRecord));
  }

  return {
    isLocked: false,
    limitReached: false,
    failedAttempts: dAttempts,
    remainingAttempts: Math.max(0, maxAllowed - dAttempts),
  };
}

/**
 * Clears this device's failed-attempt counter for the account (after a successful
 * sign-in or a password reset). Other devices' 15-minute blocks simply expire.
 */
export async function clearLoginAttempts(
  rawIdentifier: string,
  portal: Portal = 'customer'
): Promise<void> {
  const email = normalize(rawIdentifier);
  if (!email) return;
  const store = getMemoryStore();
  const deviceId = getDeviceId(false);
  if (deviceId) store.delete(deviceKey(portal, email, deviceId));
  store.delete(ipKey(portal, email, getClientIp()));
  writeGuardCookie(portal, email, null);
}

/**
 * Resets all in-memory login attempts (useful for local development or manual flush).
 */
export function clearAllLoginAttempts(): void {
  getMemoryStore().clear();
  getEmailSentStore().clear();
}
