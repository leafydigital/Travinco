import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Admin sign in',
  robots: { index: false, follow: false },
};

const REASON_MESSAGES: Record<string, string> = {
  not_staff: 'That account is a customer account, not a staff account — please sign in with your staff email.',
  deactivated: 'This staff account has been deactivated. Contact your administrator.',
};

export default function LoginPage({ searchParams }: { searchParams: { reason?: string } }) {
  const reasonMessage = searchParams.reason ? REASON_MESSAGES[searchParams.reason] : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold text-ink-900">Admin sign in</h1>
        <p className="mt-1 text-sm text-ink-500">
          Staff access only. Contact your administrator if you need an account.
        </p>
        {reasonMessage && (
          <p className="mt-4 rounded-lg bg-sand-50 px-3 py-2 text-sm text-sand-800">
            {reasonMessage}
          </p>
        )}
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
