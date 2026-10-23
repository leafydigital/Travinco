import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MINUTES = 15;
export const LOCKOUT_DURATION_MS = LOCKOUT_DURATION_MINUTES * 60 * 1000;

export interface LoginAttemptStatus {
  isLocked: boolean;
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
      cookieStore.delete(name);
      return;
    }

    const payload = JSON.stringify({
      email: email.trim().toLowerCase(),
      attempts: record.failedAttempts,
      lockedUntil: record.lockedUntil,
      lastFailedAt: record.lastFailedAt,
    });

    const encoded = Buffer.from(payload, 'utf-8').toString('base64');
    cookieStore.set(name, encoded, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: LOCKOUT_DURATION_MINUTES * 60, // 15 mins expiry
    });
  } catch {
    // Ignore cookie set failure in edge/RSC contexts
  }
}

/**
 * Checks whether the given email is currently locked out from logging in.
 */
export async function checkLoginLockout(
  rawEmail: string,
  portal: 'admin' | 'customer' = 'customer'
): Promise<LoginAttemptStatus> {
  const normalizedEmail = (rawEmail || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return {
      isLocked: false,
      failedAttempts: 0,
      remainingAttempts: MAX_LOGIN_ATTEMPTS,
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

  // 3. Optional DB lookup (if login_attempts table exists)
  try {
    const supabase = await createClient();
    const { data: dbData } = await supabase
      .from('login_attempts')
      .select('failed_attempts, locked_until, last_failed_at')
      .eq('identifier', normalizedEmail)
      .eq('portal', portal)
      .maybeSingle();

    if (dbData) {
      const dbLockedUntil = dbData.locked_until ? new Date(dbData.locked_until).getTime() : null;
      if (!record || (dbLockedUntil && (!record.lockedUntil || dbLockedUntil > record.lockedUntil))) {
        record = {
          failedAttempts: dbData.failed_attempts || 0,
          lockedUntil: dbLockedUntil,
          lastFailedAt: dbData.last_failed_at ? new Date(dbData.last_failed_at).getTime() : Date.now(),
        };
        store.set(cacheKey, record);
      }
    }
  } catch {
    // DB table might not exist yet, memory and cookie are active
  }

  const now = Date.now();

  // If there's an active lockout
  if (record?.lockedUntil && record.lockedUntil > now) {
    const msLeft = record.lockedUntil - now;
    const minutesRemaining = Math.max(1, Math.ceil(msLeft / 60000));
    return {
      isLocked: true,
      failedAttempts: record.failedAttempts,
      remainingAttempts: 0,
      minutesRemaining,
      lockedUntil: new Date(record.lockedUntil),
    };
  }

  // If lockout expired, reset attempts
  if (record?.lockedUntil && record.lockedUntil <= now) {
    record.failedAttempts = 0;
    record.lockedUntil = null;
    store.set(cacheKey, record);
    await setCookieState(normalizedEmail, portal, null);
  }

  const currentAttempts = record?.failedAttempts || 0;
  const remainingAttempts = Math.max(0, MAX_LOGIN_ATTEMPTS - currentAttempts);

  return {
    isLocked: false,
    failedAttempts: currentAttempts,
    remainingAttempts,
  };
}

/**
 * Records a failed login attempt for the given email.
 * If 5 failed attempts are reached, locks the account for 15 minutes.
 */
export async function recordFailedLoginAttempt(
  rawEmail: string,
  portal: 'admin' | 'customer' = 'customer'
): Promise<LoginAttemptStatus> {
  const normalizedEmail = (rawEmail || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return {
      isLocked: false,
      failedAttempts: 1,
      remainingAttempts: MAX_LOGIN_ATTEMPTS - 1,
    };
  }

  const cacheKey = getCacheKey(normalizedEmail, portal);
  const store = getMemoryStore();
  const existing = store.get(cacheKey) || (await getCookieState(normalizedEmail, portal));

  const now = Date.now();
  let failedAttempts = (existing?.failedAttempts || 0) + 1;
  let lockedUntil: number | null = null;
  let isLocked = false;
  let minutesRemaining = 0;

  if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
    isLocked = true;
    lockedUntil = now + LOCKOUT_DURATION_MS;
    minutesRemaining = LOCKOUT_DURATION_MINUTES;
  }

  const updatedRecord: AttemptRecord = {
    failedAttempts,
    lockedUntil,
    lastFailedAt: now,
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

  const remainingAttempts = Math.max(0, MAX_LOGIN_ATTEMPTS - failedAttempts);

  return {
    isLocked,
    failedAttempts,
    remainingAttempts,
    minutesRemaining: isLocked ? minutesRemaining : undefined,
    lockedUntil: lockedUntil ? new Date(lockedUntil) : null,
  };
}

/**
 * Clears failed login attempts for an email upon successful login or password reset.
 */
export async function clearLoginAttempts(
  rawEmail: string,
  portal: 'admin' | 'customer' = 'customer'
): Promise<void> {
  const normalizedEmail = (rawEmail || '').trim().toLowerCase();
  if (!normalizedEmail) return;

  const cacheKey = getCacheKey(normalizedEmail, portal);
  const store = getMemoryStore();
  store.delete(cacheKey);

  await setCookieState(normalizedEmail, portal, null);

  // Optional: clear in DB
  try {
    const supabase = await createClient();
    await supabase
      .from('login_attempts')
      .delete()
      .eq('identifier', normalizedEmail)
      .eq('portal', portal);
  } catch {
    // Graceful fallback
  }
}
