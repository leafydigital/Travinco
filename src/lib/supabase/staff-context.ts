/**
 * Staff context hand-off from middleware to Server Components / Server Actions.
 *
 * The middleware already verifies the staff session on every /travinco_dashboard
 * request (JWT + profiles + customer_accounts). It also loads the permission rows in
 * the same parallel round and forwards everything in a request header, so pages don't
 * repeat those queries.
 *
 * SECURITY: the middleware always deletes any incoming copy of this header before
 * (optionally) setting it, so a client can never inject it. Runtime-agnostic
 * (edge + node): uses TextEncoder/btoa only.
 */

export const STAFF_CONTEXT_HEADER = 'x-travinco-staff-ctx';

/** Larger payloads are skipped (callers then fall back to DB queries). */
const MAX_HEADER_LENGTH = 6000;

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

export function encodeStaffContext(ctx: StaffContext): string | null {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(ctx));
    let binary = '';
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    const encoded = btoa(binary);
    return encoded.length <= MAX_HEADER_LENGTH ? encoded : null;
  } catch {
    return null;
  }
}

export function decodeStaffContext(value: string | null | undefined): StaffContext | null {
  if (!value) return null;
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const ctx = JSON.parse(new TextDecoder().decode(bytes)) as StaffContext;
    return ctx?.profile?.id ? ctx : null;
  } catch {
    return null;
  }
}
