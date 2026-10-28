'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
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
  ShieldCheck,
  ArrowLeft,
  RefreshCw,
  AtSign,
} from 'lucide-react';
import {
  initiateCustomerSignup,
  resendCustomerSignupOtp,
  verifyCustomerSignupOtp,
} from '../actions';

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

// ─── 6-Digit OTP Input Subcomponent ───────────────────────────────────────────

function SignupOtpInputBoxes({
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

export default function SignupPage() {
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [isLoading, setIsLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  function validateUsername(val: string): string | null {
    const trimmed = val.trim();
    if (!trimmed) return 'Username is required';
    if (trimmed.length < 3) return 'Username must be at least 3 characters';
    if (trimmed.length > 30) return 'Username must be at most 30 characters';
    if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
      return 'Username can only contain letters, numbers, dots, and underscores';
    }
    return null;
  }

  function handleUsernameChange(val: string) {
    setUsername(val);
    if (usernameTouched) {
      setUsernameError(validateUsername(val));
    } else {
      setUsernameError(null);
    }
  }

  function handleUsernameBlur() {
    setUsernameTouched(true);
    setUsernameError(validateUsername(username));
  }

  // OTP step states
  const [signupTicket, setSignupTicket] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [cooldown, setCooldown] = useState(0);

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
  const emailLower = email.trim().toLowerCase();
  const emailIsValidDomain = emailLower.endsWith('@gmail.com') || emailLower.endsWith('.in');
  const passwordsMatch =
    password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((c) => Math.max(c - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Stage 1: Validate details, check duplicates, send OTP
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const uErr = validateUsername(username);
    if (uErr) {
      setUsernameTouched(true);
      setUsernameError(uErr);
      return;
    }

    if (isLoading || !allRulesMet || !emailIsValidDomain || !passwordsMatch) return;

    setIsLoading(true);
    setSignupError(null);
    try {
      const result = await initiateCustomerSignup({
        full_name: fullName,
        username: username.trim().toLowerCase(),
        email,
        password,
        confirm_password: confirmPassword,
      });

      if (result.error) {
        setIsLoading(false);
        setSignupError(result.error);
        toast.error(result.error);
        return;
      }

      if (result.signupTicket) {
        setSignupTicket(result.signupTicket);
        setMaskedEmail(result.maskedEmail || email);
        setOtpDigits(['', '', '', '', '', '']);
        setOtpError(null);
        setCooldown(60);
        setStep('otp');
        toast.success(`Verification code sent to ${result.maskedEmail || email}`);
      }
    } catch (err: any) {
      const message = err?.message || 'Could not initiate registration. Please try again.';
      setSignupError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  // Stage 2: Verify OTP -> Complete user account creation -> Redirect to login
  async function handleVerifyOtp(codeToVerify?: string) {
    const code = (codeToVerify || otpDigits.join('')).trim();
    if (code.length !== 6) {
      setOtpError('Please enter all 6 digits of your verification code.');
      return;
    }

    if (!signupTicket || isVerifyingOtp) return;

    setIsVerifyingOtp(true);
    setOtpError(null);
    try {
      const result = await verifyCustomerSignupOtp(signupTicket, code);

      if (result.error) {
        setOtpError(result.error);
        setIsVerifyingOtp(false);
        return;
      }

      // Successful verification! Redirect to login page with signup=success query param
      // AuthToastNotifier will show the single success snackbar on the login page
      window.location.href = '/account/login?signup=success';
    } catch (err: any) {
      setOtpError(err?.message || 'Could not verify code. Please try again.');
      setIsVerifyingOtp(false);
    }
  }

  // Resend Signup OTP
  async function handleResendOtp() {
    if (cooldown > 0 || !signupTicket || isResendingOtp) return;

    setIsResendingOtp(true);
    setOtpError(null);
    try {
      const result = await resendCustomerSignupOtp(signupTicket);
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

        {/* ── Right Column: Interactive Registration / OTP Flow ── */}
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto">
            {step === 'credentials' ? (
              // ── Stage 1: Registration Form ──
              <div>
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

                {signupError && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="font-medium leading-relaxed">{signupError}</p>
                  </div>
                )}

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

                  {/* Username (New field placed directly below Full Name) */}
                  <div>
                    <label className="label">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        disabled={isLoading}
                        placeholder="e.g. johndoe"
                        value={username}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        onBlur={handleUsernameBlur}
                        className={`input pl-10 pr-4 py-2.5 text-sm rounded-xl border-ink-200 focus:border-emerald-600 focus:ring-emerald-600 disabled:opacity-60 transition ${
                          usernameError ? 'border-coral-400 focus:ring-coral-400 bg-coral-50/20' : ''
                        }`}
                        autoComplete="username"
                      />
                      <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                    </div>
                    {usernameError && (
                      <p className="mt-1 text-xs text-coral-600 font-medium">{usernameError}</p>
                    )}
                    <p className="mt-1 text-[11px] text-ink-400 leading-snug">
                      Your unique handle to log in to your account.
                    </p>
                  </div>

                  <div>
                    <label className="label">
                      Email address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        disabled={isLoading}
                        placeholder="you@gmail.com or you@example.in"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input pl-10 pr-4 py-2.5 text-sm rounded-xl border-ink-200 focus:border-emerald-600 focus:ring-emerald-600 disabled:opacity-60 transition"
                        autoComplete="email"
                      />
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                    </div>
                    {email.length > 0 && !emailIsValidDomain && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-coral-600">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>Only @gmail.com and .in email addresses are accepted.</span>
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-ink-400 leading-snug">
                      We will send a 6-digit verification code to this address.
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

                  {/* ── Confirm Password Field ── */}
                  <div>
                    <label className="label">
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        disabled={isLoading}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`input pl-10 pr-10 py-2.5 text-sm rounded-xl border transition ${
                          confirmPassword.length > 0
                            ? passwordsMatch
                              ? 'border-emerald-500 focus:border-emerald-600 focus:ring-emerald-600'
                              : 'border-coral-400 focus:border-coral-500 focus:ring-coral-500'
                            : 'border-ink-200 focus:border-emerald-600 focus:ring-emerald-600'
                        } disabled:opacity-60`}
                        placeholder="Re-enter your password"
                        autoComplete="new-password"
                      />
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-ink-400 hover:text-ink-600 focus:outline-none cursor-pointer"
                        tabIndex={-1}
                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {confirmPassword.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                        {passwordsMatch ? (
                          <span className="text-emerald-700 flex items-center gap-1 font-medium">
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            Passwords match
                          </span>
                        ) : (
                          <span className="text-coral-600 flex items-center gap-1 font-medium">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Passwords do not match
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={
                      isLoading ||
                      !fullName.trim() ||
                      !username.trim() ||
                      Boolean(usernameError) ||
                      !allRulesMet ||
                      !emailIsValidDomain ||
                      !passwordsMatch
                    }
                    className="btn-primary w-full justify-center flex items-center gap-2 py-3 rounded-xl font-semibold shadow-md shadow-emerald-700/20 cursor-pointer disabled:opacity-50 hover:shadow-lg transition-all active:scale-[0.99] mt-3"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Sending verification code…</span>
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
            ) : (
              // ── Stage 2: OTP Verification Screen ──
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Email Verification</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('credentials');
                      setOtpError(null);
                    }}
                    className="text-xs font-medium text-ink-500 hover:text-ink-800 transition inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to edit details</span>
                  </button>
                </div>

                <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-950 tracking-tight mt-2">
                  Enter Verification Code
                </h1>
                <p className="mt-1.5 text-sm text-ink-500 leading-relaxed">
                  We sent a 6-digit code to{' '}
                  <strong className="font-semibold text-ink-900">{maskedEmail}</strong>.
                  Enter it below to complete your registration.
                </p>

                <div className="mt-8">
                  <SignupOtpInputBoxes
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
                        <span>Creating Account…</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        <span>Verify &amp; Create Account</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between pt-2 text-xs">
                    <span className="text-ink-400">Didn&apos;t receive the code?</span>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={cooldown > 0 || isResendingOtp}
                      className="font-semibold text-emerald-700 hover:text-emerald-800 disabled:text-ink-400 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {isResendingOtp ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Resending…</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3" />
                          <span>{cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-8 pt-5 border-t border-ink-100 text-center">
                  <p className="text-xs text-ink-400">
                    Entering the code verifies your email address and creates your account.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
