'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  FileText,
  Receipt,
  FolderClock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { logInCustomer, requestPasswordReset } from '../actions';

const REASON_MESSAGES: Record<string, string> = {
  not_customer:
    'This section is for customer accounts only.',
};

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo');
  const reason = searchParams.get('reason');

  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  function getSafeRedirect(path: string | null): string {
    if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
      return '/account/bookings';
    }
    return path;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    try {
      const result = await logInCustomer({ email, password });

      // ONLY show the snackbar after the API response is available
      if (result.error) {
        setIsLoading(false);
        toast.error(result.error);
        return;
      }

      toast.success('Signed in successfully');
      // Direct navigation ensures fresh cookie state without redundant RSC passes
      const target = getSafeRedirect(redirectTo);
      window.location.href = target;
    } catch (err: any) {
      setIsLoading(false);
      toast.error(err?.message || 'Login failed. Please try again.');
    }
  }

  async function handleForgotPassword() {
    if (!email.includes('@')) {
      toast.error('Enter your email address first, then click "Forgot password".');
      return;
    }
    setIsResetting(true);
    try {
      await requestPasswordReset(email);
      setResetSent(true);
      toast.success('If that email has an account, a password reset link is on its way.');
    } catch {
      toast.error('Could not request password reset. Try again.');
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="min-h-screen bg-sand-50/40 pt-24 sm:pt-28 pb-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="w-full max-w-5xl rounded-3xl bg-white shadow-2xl shadow-ink-900/5 border border-ink-100 overflow-hidden grid lg:grid-cols-12 min-h-[600px]">
        {/* ── Left Column: Travel Visual Panel (Quotations & Invoices Focus) ── */}
        <div className="relative hidden lg:flex lg:col-span-5 bg-navy-950 text-white p-10 flex-col justify-between overflow-hidden">
          {/* Background Image with Rich Gradient Overlay */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-105 hover:scale-100 opacity-35"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80')",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/80 to-emerald-950/45" />

          {/* Top Brand Pill (No Sparkles Icon) */}
          <div className="relative z-10">
            <div className="inline-flex items-center rounded-full bg-white/10 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-emerald-200 border border-white/15">
              <span>Customer Portal</span>
            </div>

            <h2 className="font-display text-3xl font-bold tracking-tight text-white mt-8 leading-tight">
              Your quotations &amp; invoices in one place.
            </h2>
            <p className="text-sm text-ink-200 mt-3 leading-relaxed">
              Log in to review your personalized travel proposals, download official invoices, and track your trip billing history.
            </p>
          </div>

          {/* Mid Features List: Centered on Quotations & Invoices */}
          <div className="relative z-10 my-8 space-y-4">
            <div className="flex items-start gap-3 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-3.5">
              <div className="rounded-xl bg-emerald-500/20 p-2 text-emerald-300 shrink-0">
                <FileText className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">Detailed Quotations</p>
                <p className="text-ink-300 mt-0.5">
                  Review customized holiday proposals, resort options, and price estimates.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-3.5">
              <div className="rounded-xl bg-amber-500/20 p-2 text-amber-300 shrink-0">
                <Receipt className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">Official Invoices</p>
                <p className="text-ink-300 mt-0.5">
                  Access and download confirmed tax invoices, payment receipts, and billing summaries.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-3.5">
              <div className="rounded-xl bg-cyan-500/20 p-2 text-cyan-300 shrink-0">
                <FolderClock className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">Booking History</p>
                <p className="text-ink-300 mt-0.5">
                  Keep all past and active trip documentation organized under your account.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Brand Note */}
          <div className="relative z-10 pt-4 border-t border-white/10">
            <p className="text-xs text-ink-300">
              Travinco · Curated Holidays &amp; Travel Concierge
            </p>
          </div>
        </div>

        {/* ── Right Column: Interactive Login Form ── */}
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Customer Access</span>
              </div>
              <Link
                href="/"
                className="text-xs font-medium text-ink-400 hover:text-ink-700 transition"
              >
                &larr; Back to Home
              </Link>
            </div>

            <h1 className="font-display text-3xl font-bold text-ink-950 tracking-tight">
              Customer Log in
            </h1>
            <p className="mt-1.5 text-sm text-ink-500 leading-relaxed">
              Welcome back! Please enter your details to view your quotations and invoices.
            </p>

            {/* Error Notice (No staff portal link exposed) */}
            {reason && REASON_MESSAGES[reason] && (
              <div className="mt-4 rounded-xl border border-sand-300 bg-sand-50 p-3.5 text-xs text-sand-900 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-sand-700 shrink-0 mt-0.5" />
                <p className="font-semibold">{REASON_MESSAGES[reason]}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="label">
                  Email address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    disabled={isLoading}
                    placeholder="you@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input pl-10 pr-4 py-2.5 text-sm rounded-xl border-ink-200 focus:border-emerald-600 focus:ring-emerald-600 disabled:opacity-60 transition"
                    autoComplete="email"
                    autoFocus
                  />
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={isResetting || isLoading}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer disabled:opacity-60"
                  >
                    {isResetting ? 'Sending link…' : 'Forgot password?'}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={isLoading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pl-10 pr-10 py-2.5 text-sm rounded-xl border-ink-200 focus:border-emerald-600 focus:ring-emerald-600 disabled:opacity-60 transition"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-ink-400 hover:text-ink-600 focus:outline-none cursor-pointer"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {resetSent && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-3 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    If that email has an account, a password reset link has been dispatched to your inbox.
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full justify-center flex items-center gap-2 py-3 rounded-xl font-semibold shadow-md shadow-emerald-700/20 cursor-pointer disabled:opacity-60 hover:shadow-lg transition-all active:scale-[0.99]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <span>Log in to Account</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Bottom Actions (Clean: no staff portal link, no SSL label) */}
            <div className="mt-6 pt-5 border-t border-ink-100 text-center">
              <p className="text-sm text-ink-600">
                Don&apos;t have an account?{' '}
                <Link
                  href="/account/signup"
                  className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  Create an account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
