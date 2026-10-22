'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  FileText,
  Receipt,
  FolderClock,
  ArrowRight,
  Check,
  Circle,
  AlertCircle,
} from 'lucide-react';
import { signUpCustomer } from '../actions';

function PasswordRule({ met, label }: { met: boolean; label: string }) {
  return (
    <div
      className={`flex items-center gap-1.5 text-xs transition-colors ${
        met ? 'text-emerald-700 font-medium' : 'text-ink-400'
      }`}
    >
      {met ? (
        <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
      ) : (
        <Circle className="h-3 w-3 text-ink-300 shrink-0" />
      )}
      <span>{label}</span>
    </div>
  );
}

export default function SignupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Live password validation
  const rules = useMemo(
    () => ({
      length: password.length >= 7,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      symbol: /[^A-Za-z0-9]/.test(password),
    }),
    [password]
  );

  const allRulesMet = Object.values(rules).every(Boolean);
  const emailIsGmail = email.trim().toLowerCase().endsWith('@gmail.com');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading || !allRulesMet || !emailIsGmail) return;

    setIsLoading(true);
    try {
      const result = await signUpCustomer({ full_name: fullName, email, password });

      // ONLY show snackbar when API response is available
      if (result.error) {
        setIsLoading(false);
        toast.error(result.error);
        return;
      }

      if (result.hasSession) {
        toast.success('Account created! Welcome to Travinco.');
        window.location.href = '/account/bookings';
      } else {
        toast.success('Account created! Check your email to confirm, then log in.');
        window.location.href = '/account/login';
      }
    } catch (err: any) {
      setIsLoading(false);
      toast.error(err?.message || 'Failed to create account. Please try again.');
    }
  }

  return (
    <div className="min-h-screen bg-sand-50/40 pt-24 sm:pt-28 pb-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="w-full max-w-5xl rounded-3xl bg-white shadow-2xl shadow-ink-900/5 border border-ink-100 overflow-hidden grid lg:grid-cols-12 min-h-[640px]">
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

          {/* Top Brand Pill */}
          <div className="relative z-10">
            <div className="inline-flex items-center rounded-full bg-white/10 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-emerald-200 border border-white/15">
              <span>Customer Portal</span>
            </div>

            <h2 className="font-display text-3xl font-bold tracking-tight text-white mt-8 leading-tight">
              Your quotations &amp; invoices in one place.
            </h2>
            <p className="text-sm text-ink-200 mt-3 leading-relaxed">
              Create your account to view custom travel proposals, track quotation estimates, and download official invoices.
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

        {/* ── Right Column: Interactive Registration Form ── */}
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>New Registration</span>
              </div>
              <Link
                href="/"
                className="text-xs font-medium text-ink-400 hover:text-ink-700 transition"
              >
                &larr; Back to Home
              </Link>
            </div>

            <h1 className="font-display text-3xl font-bold text-ink-950 tracking-tight">
              Create your account
            </h1>
            <p className="mt-1.5 text-sm text-ink-500 leading-relaxed">
              Sign up to access your tailored itineraries, quotations, and trip invoices.
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="label">
                  Full name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    disabled={isLoading}
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input pl-10 pr-4 py-2.5 text-sm rounded-xl border-ink-200 focus:border-emerald-600 focus:ring-emerald-600 disabled:opacity-60 transition"
                    autoComplete="name"
                    autoFocus
                  />
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                </div>
              </div>

              <div>
                <label className="label">
                  Gmail address <span className="text-red-500">*</span>
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
                  />
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                </div>
                {email.length > 0 && !emailIsGmail && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-coral-600">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Only @gmail.com addresses are accepted.</span>
                  </p>
                )}
                <p className="mt-1 text-[11px] text-ink-400 leading-snug">
                  We&apos;ll send a confirmation link to this address — use the same one provided when booking.
                </p>
              </div>

              <div>
                <label className="label">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={isLoading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pl-10 pr-10 py-2.5 text-sm rounded-xl border-ink-200 focus:border-emerald-600 focus:ring-emerald-600 disabled:opacity-60 transition"
                    placeholder="Create a strong password"
                    autoComplete="new-password"
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

                {/* Password Requirements Checklist */}
                <div className="mt-2.5 rounded-xl bg-ink-50/70 border border-ink-100 p-3 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                    Password Requirements:
                  </p>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    <PasswordRule met={rules.length} label="7+ characters" />
                    <PasswordRule met={rules.upper} label="1 uppercase (A-Z)" />
                    <PasswordRule met={rules.lower} label="1 lowercase (a-z)" />
                    <PasswordRule met={rules.number} label="1 number (0-9)" />
                    <div className="col-span-2">
                      <PasswordRule met={rules.symbol} label="1 symbol (e.g. !@#$%)" />
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !allRulesMet || !emailIsGmail}
                className="btn-primary w-full justify-center flex items-center gap-2 py-3 rounded-xl font-semibold shadow-md shadow-emerald-700/20 cursor-pointer disabled:opacity-50 hover:shadow-lg transition-all active:scale-[0.99] mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating account…</span>
                  </>
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Bottom Actions */}
            <div className="mt-6 pt-5 border-t border-ink-100 text-center">
              <p className="text-sm text-ink-600">
                Already have an account?{' '}
                <Link
                  href="/account/login"
                  className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  Log in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
