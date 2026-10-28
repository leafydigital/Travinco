/**
 * Customer account area (login, signup, bookings, …) is per-user and reads the
 * session / query string, so it is always rendered per request. The rest of the
 * public site is cached (see src/app/(public)/layout.tsx).
 */
export const dynamic = 'force-dynamic';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
