import { redirect } from 'next/navigation';

/**
 * Legacy Supabase recovery-link landing page. Password recovery now runs on the
 * sign-in page (email -> emailed code -> new password), so send visitors there.
 */
export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  const query = new URLSearchParams({ action: 'forgot_password' });
  if (searchParams.email) query.set('email', searchParams.email);
  redirect(`/account/login?${query.toString()}`);
}
