import { PAGE_CATALOG, CATEGORIES, type PageDefinition } from './admin-pages';

/**
 * Role-based page access.
 *
 * Every staff user belongs to one role (profiles.role_id → staff_roles). A role is a
 * name plus the dashboard pages it can open. The built-in "Admin" role (is_system)
 * has every page, including Role Management (Roles & Users), which custom roles
 * can never include.
 */

/** Role Management pages — admin only, never assignable to a custom role. */
export const ADMIN_ONLY_PAGE_KEYS = ['roles', 'users', 'plugins'];

/** Pages an admin can tick for a custom role. */
export const ASSIGNABLE_PAGES: PageDefinition[] = PAGE_CATALOG.filter(
  (p) => !p.adminOnly && !ADMIN_ONLY_PAGE_KEYS.includes(p.key)
);

export const ASSIGNABLE_PAGE_KEYS = ASSIGNABLE_PAGES.map((p) => p.key);

/** Assignable pages grouped by sidebar section, in sidebar order. */
export const ASSIGNABLE_PAGE_GROUPS = CATEGORIES.map((category) => ({
  category,
  pages: ASSIGNABLE_PAGES.filter((p) => p.category === category),
})).filter((g) => g.pages.length > 0);

export const PAGE_LABELS: Record<string, string> = Object.fromEntries(
  PAGE_CATALOG.map((p) => [p.key, p.label])
);

/** Keeps only known, assignable page keys (dedupes, preserves catalog order). */
export function sanitizeRolePages(keys: string[]): string[] {
  const wanted = new Set(keys);
  return ASSIGNABLE_PAGE_KEYS.filter((k) => wanted.has(k));
}

/** Role name: letters with single spaces (plus & and -), 2–50 characters. */
export function validateRoleName(value: string): string | null {
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) return 'Role name is required';
  if (name.length < 2) return 'Role name must be at least 2 characters';
  if (name.length > 50) return 'Role name must be 50 characters or fewer';
  if (!/^[A-Za-z]+(?:[ &-]+[A-Za-z]+)*$/.test(name)) {
    return 'Role name can only contain letters and spaces (no numbers or symbols)';
  }
  return null;
}

export type ProfileRoleInfo = { pages: string[]; isSystem: boolean } | null;

/**
 * Reads the role embedded on a profile row (`staff_roles` relation selected
 * alongside the profile). Returns null when the user has no role yet, in which
 * case the legacy per-user / default access rules still apply.
 */
export function roleInfoFromProfile(profile: Record<string, unknown> | null | undefined): ProfileRoleInfo {
  if (!profile || !profile.role_id) return null;
  const raw = profile.staff_roles as
    | { pages?: string[] | null; is_system?: boolean | null }
    | { pages?: string[] | null; is_system?: boolean | null }[]
    | null
    | undefined;
  const role = Array.isArray(raw) ? raw[0] : raw;
  if (!role) return null;
  return { pages: Array.isArray(role.pages) ? role.pages : [], isSystem: Boolean(role.is_system) };
}

/** PostgREST select for a profile together with its role's pages. */
export const PROFILE_WITH_ROLE_SELECT = '*, staff_roles!profiles_role_id_fkey(pages, is_system)';
