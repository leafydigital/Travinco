import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { sendGmail } from '@/lib/email/gmail';

export const MAX_ADMIN_LOGIN_ATTEMPTS = 5;
export const MAX_CUSTOMER_LOGIN_ATTEMPTS = 3;
export const MAX_LOGIN_ATTEMPTS = MAX_CUSTOMER_LOGIN_ATTEMPTS; // alias for backwards compatibility
export const LOCKOUT_DURATION_MINUTES = 15;
export const LOCKOUT_DURATION_MS = LOCKOUT_DURATION_MINUTES * 60 * 1000;

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
  limitEmailSent?: boolean;
}

// In-memory cache across server requests in the Node.js process
const memoryStore = new Map<string, AttemptRecord>();

// Attach to globalThis to survive HMR in local dev
declare global {
  // eslint-disable-next-line no-var
  var __travincoLoginAttemptsStore: Map<string, AttemptRecord> | undefined;
}

function getMemoryStore(): Map<string, AttemptRecord> {
  if (!globalThis.__travincoLoginAttemptsStore) {
    globalThis.__travincoLoginAttemptsStore = memoryStore;
  }
  return globalThis.__travincoLoginAttemptsStore;
}

function getCacheKey(email: string, portal: 'admin' | 'customer'): string {
  return `${portal}:${email.trim().toLowerCase()}`;
}

function getCookieName(portal: 'admin' | 'customer'): string {
  return `sb_${portal}_attempt_state`;
}

/**
 * Reads attempt state from the client cookie as an extra layer of persistence.
 */
async function getCookieState(
  email: string,
  portal: 'admin' | 'customer'
): Promise<AttemptRecord | null> {
  try {
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get(getCookieName(portal))?.value;
    if (!cookieVal) return null;

    const decoded = JSON.parse(Buffer.from(cookieVal, 'base64').toString('utf-8'));
    if (decoded && decoded.email === email.trim().toLowerCase()) {
      return {
        failedAttempts: Number(decoded.attempts) || 0,
        lockedUntil: decoded.lockedUntil ? Number(decoded.lockedUntil) : null,
        lastFailedAt: decoded.lastFailedAt ? Number(decoded.lastFailedAt) : Date.now(),
        limitEmailSent: Boolean(decoded.limitEmailSent),
      };
    }
  } catch {
    // Ignore cookie parse error
  }
  return null;
}

/**
 * Saves attempt state into the client cookie.
 */
async function setCookieState(
  email: string,
  portal: 'admin' | 'customer',
  record: AttemptRecord | null
): Promise<void> {
  try {
    const cookieStore = await cookies();
    const name = getCookieName(portal);
    if (!record || (record.failedAttempts === 0 && !record.lockedUntil)) {
      try {
        cookieStore.delete({ name, path: '/' });
      } catch {
        // Ignore fallback
      }
      try {
        cookieStore.delete(name);
      } catch {
        // Ignore fallback
      }
      cookieStore.set(name, '', {
        path: '/',
        maxAge: 0,
        expires: new Date(0),
      });
      return;
    }

    const payload = JSON.stringify({
      email: email.trim().toLowerCase(),
      attempts: record.failedAttempts,
      lockedUntil: record.lockedUntil,
      lastFailedAt: record.lastFailedAt,
      limitEmailSent: record.limitEmailSent,
    });

    const encoded = Buffer.from(payload, 'utf-8').toString('base64');
    cookieStore.set(name, encoded, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60, // 7 days until cleared by password reset or success
    });
  } catch {
    // Ignore cookie set failure in edge/RSC contexts
  }
}

/**
 * Dispatches an automated security notification email when a customer reaches 3 failed attempts.
 */
export async function sendLoginLimitReachedEmail({
  email,
  fullName,
}: {
  email: string;
  fullName?: string;
}): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const displayName = fullName || normalizedEmail.split('@')[0] || 'Traveler';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://travinco.vercel.app';
  const resetUrl = `${siteUrl.replace(/\/$/, '')}/account/login?action=forgot_password&email=${encodeURIComponent(normalizedEmail)}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Login Limit Reached - Travinco</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 24px; margin: 0;">
        <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="background-color: #022c22; padding: 28px 24px; text-align: center;">
            <h1 style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 700; letter-spacing: 1px;">TRAVINCO</h1>
            <p style="color: #fca5a5; font-size: 13px; margin: 6px 0 0; text-transform: uppercase; letter-spacing: 1.5px;">Security Notification</p>
          </div>
          <div style="padding: 32px 28px;">
            <p style="font-size: 15px; color: #1e293b; margin: 0 0 16px; font-weight: 600;">Hello ${displayName},</p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 16px;">
              You have reached your login limit of <strong>3 consecutive failed attempts</strong> for your Travinco customer account (<code>${normalizedEmail}</code>).
            </p>
            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 18px 20px; margin: 0 0 24px;">
              <p style="font-size: 14px; color: #991b1b; margin: 0; font-weight: 600;">
                You have reached your login limit. Please reset your password to regain access to your account.
              </p>
            </div>
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px;">
              To protect your account, sign-in is paused until your password is reset. Click the button below to set a new password:
            </p>
            <div style="text-align: center; margin: 0 0 24px;">
              <a href="${resetUrl}" style="background-color: #047857; color: #ffffff; padding: 13px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 2px 4px rgba(4,120,87,0.2);">
                Reset Your Password
              </a>
            </div>
            <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0;">
              If you did not perform these login attempts, someone may be trying to access your account. Please reset your password immediately or contact our support team.
            </p>
          </div>
          <div style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 16px 24px; text-align: center;">
            <p style="font-size: 11px; color: #94a3b8; margin: 0;">&copy; ${new Date().getFullYear()} Travinco Tours. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    await sendGmail({
      to: normalizedEmail,
      subject: 'Security Alert: You have reached your login limit — Reset your password',
      html,
    });
  } catch (err) {
    console.warn('Failed to send login limit email:', err);
  }
}

/**
 * Checks whether the given email has reached the login limit.
 * For Customer Portal: 3 failed attempts max, NO lockout timer countdown.
 * For Admin Portal: 5 failed attempts max, 15-minute lockout timer.
 */
export async function checkLoginLockout(
  rawEmail: string,
  portal: 'admin' | 'customer' = 'customer'
): Promise<LoginAttemptStatus> {
  const normalizedEmail = (rawEmail || '').trim().toLowerCase();
  const maxAllowed = portal === 'customer' ? MAX_CUSTOMER_LOGIN_ATTEMPTS : MAX_ADMIN_LOGIN_ATTEMPTS;

  if (!normalizedEmail) {
    return {
      isLocked: false,
      limitReached: false,
      failedAttempts: 0,
      remainingAttempts: maxAllowed,
    };
  }

  const cacheKey = getCacheKey(normalizedEmail, portal);
  const store = getMemoryStore();

  // 1. Try reading from memory store
  let record = store.get(cacheKey) || null;

  // 2. Try cookie fallback if memory store doesn't have it
  if (!record) {
    const cookieRecord = await getCookieState(normalizedEmail, portal);
    if (cookieRecord) {
      record = cookieRecord;
      store.set(cacheKey, record);
    }
  }

  const failedAttempts = record?.failedAttempts || 0;

  // Customer portal behavior: 3 attempts limit, NO timer lockout
  if (portal === 'customer') {
    const limitReached = failedAttempts >= MAX_CUSTOMER_LOGIN_ATTEMPTS;
    return {
      isLocked: false,
      limitReached,
      failedAttempts,
      remainingAttempts: Math.max(0, MAX_CUSTOMER_LOGIN_ATTEMPTS - failedAttempts),
    };
  }

  // Admin portal behavior: 15-min lockout timer
  const now = Date.now();
  if (record?.lockedUntil && record.lockedUntil > now) {
    const msLeft = record.lockedUntil - now;
    const minutesRemaining = Math.max(1, Math.ceil(msLeft / 60000));
    return {
      isLocked: true,
      limitReached: true,
      failedAttempts: record.failedAttempts,
      remainingAttempts: 0,
      minutesRemaining,
      lockedUntil: new Date(record.lockedUntil),
    };
  }

  if (record?.lockedUntil && record.lockedUntil <= now) {
    record.failedAttempts = 0;
    record.lockedUntil = null;
    store.set(cacheKey, record);
    await setCookieState(normalizedEmail, portal, null);
  }

  return {
    isLocked: false,
    limitReached: false,
    failedAttempts,
    remainingAttempts: Math.max(0, MAX_ADMIN_LOGIN_ATTEMPTS - failedAttempts),
  };
}

/**
 * Records a failed login attempt for the given email.
 * If 3 failed attempts are reached on customer portal:
 * - NO lockout timer
 * - Sends email to user: "You have reached your login limit. Reset your password."
 * - Returns limitReached: true
 */
export async function recordFailedLoginAttempt(
  rawEmail: string,
  portal: 'admin' | 'customer' = 'customer',
  fullName?: string
): Promise<LoginAttemptStatus> {
  const normalizedEmail = (rawEmail || '').trim().toLowerCase();
  const maxAllowed = portal === 'customer' ? MAX_CUSTOMER_LOGIN_ATTEMPTS : MAX_ADMIN_LOGIN_ATTEMPTS;

  if (!normalizedEmail) {
    return {
      isLocked: false,
      limitReached: false,
      failedAttempts: 1,
      remainingAttempts: maxAllowed - 1,
    };
  }

  const cacheKey = getCacheKey(normalizedEmail, portal);
  const store = getMemoryStore();
  const existing = store.get(cacheKey) || (await getCookieState(normalizedEmail, portal));

  const now = Date.now();
  const failedAttempts = (existing?.failedAttempts || 0) + 1;
  let lockedUntil: number | null = null;
  let isLocked = false;
  let minutesRemaining = 0;
  let limitReached = false;
  let limitEmailSent = existing?.limitEmailSent || false;

  if (portal === 'customer') {
    if (failedAttempts >= MAX_CUSTOMER_LOGIN_ATTEMPTS) {
      limitReached = true;
      // Send security alert email on reaching limit
      if (!limitEmailSent) {
        await sendLoginLimitReachedEmail({ email: normalizedEmail, fullName });
        limitEmailSent = true;
      }
    }
  } else {
    // Admin portal
    if (failedAttempts >= MAX_ADMIN_LOGIN_ATTEMPTS) {
      isLocked = true;
      limitReached = true;
      lockedUntil = now + LOCKOUT_DURATION_MS;
      minutesRemaining = LOCKOUT_DURATION_MINUTES;
    }
  }

  const updatedRecord: AttemptRecord = {
    failedAttempts,
    lockedUntil,
    lastFailedAt: now,
    limitEmailSent,
  };

  store.set(cacheKey, updatedRecord);
  await setCookieState(normalizedEmail, portal, updatedRecord);

  // Optional: write to database table if available
  try {
    const supabase = await createClient();
    await supabase.from('login_attempts').upsert(
      {
        identifier: normalizedEmail,
        portal,
        failed_attempts: failedAttempts,
        locked_until: lockedUntil ? new Date(lockedUntil).toISOString() : null,
        last_failed_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString(),
      },
      { onConflict: 'identifier,portal' }
    );
  } catch {
    // Graceful fallback if table does not exist
  }

  const remainingAttempts = Math.max(0, maxAllowed - failedAttempts);

  return {
    isLocked,
    limitReached,
    failedAttempts,
    remainingAttempts,
    minutesRemaining: isLocked ? minutesRemaining : undefined,
    lockedUntil: lockedUntil ? new Date(lockedUntil) : null,
  };
}

/**
 * Clears failed login attempts for an email or username upon successful login or password reset.
 */
export async function clearLoginAttempts(
  rawIdentifier: string,
  portal: 'admin' | 'customer' = 'customer'
): Promise<void> {
  const normalized = (rawIdentifier || '').trim().toLowerCase();
  if (!normalized) return;

  const store = getMemoryStore();
  store.delete(getCacheKey(normalized, portal));

  // If customer portal, also resolve and clear related email/username key
  if (portal === 'customer') {
    try {
      const { createServiceClient } = await import('@/lib/supabase/service');
      const serviceSupabase = createServiceClient();
      if (!normalized.includes('@')) {
        // Was username -> resolve email and clear
        const { data: row } = await serviceSupabase
          .from('customer_accounts')
          .select('email')
          .ilike('username', normalized)
          .maybeSingle();
        if (row?.email) {
          store.delete(getCacheKey(row.email.toLowerCase(), portal));
        }
      } else {
        // Was email -> resolve username and clear
        const { data: row } = await serviceSupabase
          .from('customer_accounts')
          .select('username')
          .ilike('email', normalized)
          .maybeSingle();
        if (row?.username) {
          store.delete(getCacheKey(row.username.toLowerCase(), portal));
        }
      }
    } catch {
      // Graceful fallback
    }
  }

  await setCookieState(normalized, portal, null);

  // Clear from database login_attempts table as well if present
  try {
    const supabase = await createClient();
    await supabase
      .from('login_attempts')
      .delete()
      .eq('identifier', normalized)
      .eq('portal', portal);
  } catch {
    // Graceful fallback
  }
}

/**
 * Resets all in-memory login attempts (useful for local development or manual flush).
 */
export function clearAllLoginAttempts(): void {
  const store = getMemoryStore();
  store.clear();
}
