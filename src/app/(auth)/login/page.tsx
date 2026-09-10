import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Admin sign in',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold text-ink-900">Admin sign in</h1>
        <p className="mt-1 text-sm text-ink-500">
          Staff access only. Contact your administrator if you need an account.
        </p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
