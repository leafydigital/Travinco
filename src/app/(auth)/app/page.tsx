import type { Metadata } from 'next';
import { StaffLoginForm } from './staff-login-form';

export const metadata: Metadata = {
  title: 'Team sign in — Travinco',
  robots: { index: false, follow: false },
};

// Reads the query string (redirectTo / reason) on every request
export const dynamic = 'force-dynamic';

const REASONS: Record<string, string> = {
  not_staff: 'That account does not have access to the admin dashboard. Please sign in with a staff account.',
  forbidden: 'Access denied: you do not have permission to access that page.',
  deactivated: 'This staff account has been deactivated. Please contact your administrator.',
  session_expired: 'Your session has expired. Please sign in again.',
};

/** Internal team (admin & staff) sign-in. Customers use /account/login. */
export default function StaffLoginPage({
  searchParams,
}: {
  searchParams: { redirectTo?: string; reason?: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-sand-50 px-4 py-12">
      <StaffLoginForm
        redirectTo={searchParams.redirectTo}
        notice={searchParams.reason ? REASONS[searchParams.reason] ?? null : null}
      />
    </main>
  );
}
