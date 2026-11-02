/**
 * Staff context hand-off from middleware to Server Components / Server Actions.
 *
 * The middleware already verifies the staff session on every /travinco_dashboard
 * request (JWT + profiles + customer_accounts). It also loads the permission rows in
 * the same parallel round and forwards everything in a request header, so pages don't
 * repeat those queries.
 *
 * SECURITY: the middleware deletes any incoming copy of this header, but it does not
 * run on every path (see the matcher), so the header is also HMAC-signed with a
 * server-only secret and expires quickly. A header that fails verification is ignored
 * and callers fall back to verifying the session against the database.
 * Runtime-agnostic (edge + node): uses TextEncoder/btoa and Web Crypto only.
 */

export const STAFF_CONTEXT_HEADER = 'x-travinco-staff-ctx';

/** Larger payloads are skipped (callers then fall back to DB queries). */
const MAX_HEADER_LENGTH = 6000;

/** The header only needs to live for the request it was created for. */
const MAX_AGE_MS = 60 * 1000;

export interface StaffContext {
  profile: Record<string, any>;
  /** Raw permission inputs, transformed exactly like getStaffPermissions() does. */
  perms: {
    rows: Record<string, any>[];
    settingValue: unknown;
    /** The user's role pages (null = no role assigned yet → legacy rules). */
    role?: { pages: string[]; isSystem: boolean } | null;
  };
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

/** HMAC key derived from the server-only service role key (never sent to the browser). */
async function getSigningKey(): Promise<CryptoKey | null> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const subtle = globalThis.crypto?.subtle;
  if (!secret || !subtle) return null;
  return subtle.importKey(
    'raw',
    new TextEncoder().encode(`travinco-staff-ctx:${secret}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function encodeStaffContext(ctx: StaffContext): Promise<string | null> {
  try {
    const key = await getSigningKey();
    if (!key) return null;
    const payload = toBase64(new TextEncoder().encode(JSON.stringify({ ctx, iat: Date.now() })));
    const sig = await globalThis.crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    const encoded = `${payload}.${toBase64(new Uint8Array(sig))}`;
    return encoded.length <= MAX_HEADER_LENGTH ? encoded : null;
  } catch {
    return null;
  }
}

export async function decodeStaffContext(value: string | null | undefined): Promise<StaffContext | null> {
  if (!value) return null;
  try {
    const [payload, sigB64] = value.split('.');
    if (!payload || !sigB64) return null;
    const key = await getSigningKey();
    if (!key) return null;
    const sig = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
    const valid = await globalThis.crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(payload));
    if (!valid) return null;

    const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
    const { ctx, iat } = JSON.parse(new TextDecoder().decode(bytes)) as { ctx: StaffContext; iat: number };
    if (typeof iat !== 'number' || Math.abs(Date.now() - iat) > MAX_AGE_MS) return null;
    return ctx?.profile?.id ? ctx : null;
  } catch {
    return null;
  }
}
