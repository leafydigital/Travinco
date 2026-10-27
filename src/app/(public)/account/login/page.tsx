'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import {
  initiateCustomerLogin,
  resendCustomerLoginOtp,
  verifyCustomerLoginOtp,
  requestPasswordReset,
} from '../actions';

const REASON_MESSAGES: Record<string, string> = {
  not_customer: 'This page is for travellers. Please sign in with your traveller account.',
};

// ─── 6-Digit OTP Input Subcomponent ───────────────────────────────────────────

function LoginOtpInputBoxes({
  value,
  onChange,
  onComplete,
  disabled,
}: {
  value: string[];
  onChange: (digits: string[]) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Auto-focus first empty input on initial mount only
    const firstEmpty = value.findIndex((v) => !v);
    const targetIdx = firstEmpty === -1 ? 0 : firstEmpty;
    inputsRef.current[targetIdx]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDigitChange(idx: number, e: React.ChangeEvent<HTMLInputElement>) {
    const rawVal = e.target.value;
    const digit = rawVal.replace(/\D/g, '').slice(-1);

    const next = [...value];
    next[idx] = digit;
    onChange(next);

    if (digit && idx < 5) {
      inputsRef.current[idx + 1]?.focus();
    }

    const fullCode = next.join('');
    if (fullCode.length === 6) {
      onComplete?.(fullCode);
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !value[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const next = [...value];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || '';
    }
    onChange(next);

    const focusIdx = Math.min(pasted.length, 5);
    inputsRef.current[focusIdx]?.focus();

    if (pasted.length === 6) {
      onComplete?.(pasted);
    }
  }

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          disabled={disabled}
          value={value[i] || ''}
          onChange={(e) => handleDigitChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="h-12 w-11 sm:h-14 sm:w-13 rounded-xl border border-ink-200 bg-white text-center text-xl sm:text-2xl font-bold text-emerald-950 shadow-sm transition-all focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo');
  const reason = searchParams.get('reason');

  // Login steps: 'credentials' -> 'otp'
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');

  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [loginError, setLoginError] = useState<{
    message: string;
    isLocked?: boolean;
    remainingAttempts?: number;
  } | null>(null);

  // OTP step states
  const [loginTicket, setLoginTicket] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  function getSafeRedirect(path: string | null): string {
    if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
      return '/account/bookings';
    }
    return path;
  }

  // Prefetch destination so client-side transition happens instantly
  useEffect(() => {
    const target = getSafeRedirect(redirectTo);
    router.prefetch(target);
  }, [redirectTo, router]);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((c) => Math.max(c - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Step 1: Submit Credentials -> Backend validates & sends OTP
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setLoginError(null);
    try {
      const result = await initiateCustomerLogin({ email, password });

      if (result.error) {
        setIsLoading(false);
        setLoginError({
          message: result.error,
          isLocked: result.isLocked,
          remainingAttempts: result.remainingAttempts,
        });
        toast.error(result.error);
        return;
      }

      if (result.step === 'otp_required' && result.loginTicket) {
        setLoginTicket(result.loginTicket);
        setMaskedEmail(result.maskedEmail || email);
        setOtpDigits(['', '', '', '', '', '']);
        setOtpError(null);
        setCooldown(60);
        setStep('otp');
        toast.success(`Verification code sent to ${result.maskedEmail || email}`);
      }
    } catch (err: any) {
      const message = err?.message || 'Unable to sign in right now. Please try again.';
      setLoginError({ message });
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  // Step 2: Verify OTP -> Complete session establishment
  async function handleVerifyOtp(codeToVerify?: string) {
    const code = (codeToVerify || otpDigits.join('')).trim();
    if (code.length !== 6) {
      setOtpError('Please enter all 6 digits of your verification code.');
      return;
    }

    if (!loginTicket || isVerifyingOtp) return;

    setIsVerifyingOtp(true);
    setOtpError(null);
    try {
      const result = await verifyCustomerLoginOtp(loginTicket, code);

      if (result.error) {
        setOtpError(result.error);
        setIsVerifyingOtp(false);
        return;
      }

      // Do NOT trigger toast on the login page; AuthToastNotifier on the destination page shows it after redirect
      const target = getSafeRedirect(redirectTo);
      const separator = target.includes('?') ? '&' : '?';
      router.replace(`${target}${separator}login=success`);
    } catch (err: any) {
      setOtpError(err?.message || 'Could not verify your code. Please try again.');
      setIsVerifyingOtp(false);
    }
  }

  // Resend Login OTP
  async function handleResendOtp() {
    if (cooldown > 0 || !loginTicket || isResendingOtp) return;

    setIsResendingOtp(true);
    setOtpError(null);
    try {
      const result = await resendCustomerLoginOtp(loginTicket);
      if (result.error) {
        setOtpError(result.error);
      } else {
        setCooldown(60);
        toast.success('A new verification code has been sent to your email.');
      }
    } catch {
      setOtpError('Could not resend the verification code. Please try again in a moment.');
    } finally {
      setIsResendingOtp(false);
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
              Log in to review your personalized travel proposals, download official invoices, and track your trip billing history.
            </p>
          </div>

          {/* Mid Features List */}
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
          </div>

          {/* Bottom Security Assurance */}
          <div className="relative z-10 text-[11px] text-ink-300">
            <span>&copy; {new Date().getFullYear()} Travinco. Secured with two-factor email OTP verification.</span>
          </div>
        </div>

        {/* ── Right Column: Interactive Login Flow ───────────────────────── */}
        <div className="lg:col-span-7 p-8 sm:p-12 lg:p-14 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto">
            {step === 'credentials' ? (
              <>
                <div className="flex items-center justify-between mb-2">
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

                {reason && REASON_MESSAGES[reason] && (
                  <div className="mt-4 rounded-xl border border-sand-300 bg-sand-50 p-3.5 text-xs text-sand-900 flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 text-sand-700 shrink-0 mt-0.5" />
                    <p className="font-semibold">{REASON_MESSAGES[reason]}</p>
                  </div>
                )}

                {loginError && (
                  <div
                    className={`mt-4 rounded-xl border p-3.5 text-xs transition-all ${
                      loginError.isLocked
                        ? 'border-red-300 bg-red-50 text-red-900 shadow-sm'
                        : typeof loginError.remainingAttempts === 'number' && loginError.remainingAttempts < 5
                        ? 'border-amber-300 bg-amber-50 text-amber-900 shadow-sm'
                        : 'border-red-200 bg-red-50 text-red-700'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {loginError.isLocked ? (
                        <ShieldAlert className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                      ) : typeof loginError.remainingAttempts === 'number' && loginError.remainingAttempts < 5 ? (
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                      )}
                      <div className="flex-1 space-y-1">
                        {loginError.isLocked ? (
                          <p className="font-bold text-red-950 uppercase tracking-wide text-[11px]">
                            Account Temporarily Locked (5/5 Attempts)
                          </p>
                        ) : typeof loginError.remainingAttempts === 'number' && loginError.remainingAttempts < 5 ? (
                          <p className="font-bold text-amber-950 text-[11px] uppercase tracking-wide">
                            Login Attempt Failed ({5 - loginError.remainingAttempts} of 5)
                          </p>
                        ) : null}
                        <p className="leading-relaxed">{loginError.message}</p>
                        {loginError.isLocked && (
                          <button
                            type="button"
                            onClick={handleForgotPassword}
                            disabled={isResetting}
                            className="mt-1 text-xs font-semibold text-red-800 hover:text-red-950 underline inline-block cursor-pointer"
                          >
                            Forgot password &rarr;
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

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
                        <span>Continue</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>

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
              </>
            ) : (
              // ── Stage 2: OTP Verification Screen ──
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Security Verification</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('credentials');
                      setOtpError(null);
                    }}
                    className="text-xs font-medium text-ink-500 hover:text-ink-800 transition inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to login</span>
                  </button>
                </div>

                <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-950 tracking-tight mt-2">
                  Enter Verification Code
                </h1>
                <p className="mt-1.5 text-sm text-ink-500 leading-relaxed">
                  We sent a 6-digit code to{' '}
                  <strong className="font-semibold text-ink-900">{maskedEmail}</strong>.
                  Enter it below to complete your sign in.
                </p>

                <div className="mt-8">
                  <LoginOtpInputBoxes
                    value={otpDigits}
                    onChange={setOtpDigits}
                    onComplete={(code) => handleVerifyOtp(code)}
                    disabled={isVerifyingOtp}
                  />
                </div>

                {otpError && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <p>{otpError}</p>
                  </div>
                )}

                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={() => handleVerifyOtp()}
                    disabled={otpDigits.join('').length !== 6 || isVerifyingOtp}
                    className="btn-primary w-full justify-center flex items-center gap-2 py-3.5 rounded-xl font-semibold shadow-md shadow-emerald-700/20 cursor-pointer disabled:opacity-60 hover:shadow-lg transition-all"
                  >
                    {isVerifyingOtp ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Verifying &amp; Signing In…</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        <span>Verify &amp; Sign In</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between pt-2 text-xs text-ink-500">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('credentials');
                        setOtpError(null);
                      }}
                      className="font-medium text-ink-600 hover:text-ink-900 hover:underline cursor-pointer"
                    >
                      Re-enter password
                    </button>

                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={cooldown > 0 || isResendingOtp}
                      className={`inline-flex items-center gap-1 font-semibold transition ${
                        cooldown > 0
                          ? 'text-ink-400 cursor-not-allowed'
                          : 'text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer'
                      }`}
                    >
                      <RefreshCw className={`h-3 w-3 ${isResendingOtp ? 'animate-spin' : ''}`} />
                      <span>{cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
