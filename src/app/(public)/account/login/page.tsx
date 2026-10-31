'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
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
  KeyRound,
  Check,
  Circle,
  User,
} from 'lucide-react';
import {
  initiateCustomerLogin,
  resendCustomerLoginOtp,
  verifyCustomerLoginOtp,
  startCustomerPasswordReset,
  resendCustomerResetOtpAction,
  verifyCustomerResetOtpAction,
  saveCustomerResetPasswordAction,
} from '../actions';
import { useStepHistory } from '@/lib/hooks/use-step-history';

const REASON_MESSAGES: Record<string, string> = {
  not_customer: 'This page is for travellers. Please sign in with your traveller account.',
  not_staff: 'You do not have staff permissions to access the admin dashboard.',
  forbidden: 'Access denied: You do not have permission to access that page.',
  deactivated: 'Your account is deactivated. Please contact the Travinco team.',
  deleted: 'Unable to login. Please contact the Travinco team.',
  reset_success: 'Your password has been reset successfully! Please sign in with your new password.',
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
    const firstEmptyIndex = value.findIndex((digit) => !digit);
    const targetIndex = firstEmptyIndex === -1 ? 0 : firstEmptyIndex;
    inputsRef.current[targetIndex]?.focus();
  }, []);

  function handleDigitChange(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const rawVal = e.target.value.replace(/\D/g, '');
    const next = [...value];

    if (!rawVal) {
      next[index] = '';
      onChange(next);
      return;
    }

    if (rawVal.length > 1) {
      // Pasted full code or multiple digits
      const digits = rawVal.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        next[i] = digits[i] || '';
      }
      onChange(next);
      const lastIndex = Math.min(digits.length, 5);
      inputsRef.current[lastIndex]?.focus();
      if (digits.length === 6 && onComplete) {
        onComplete(digits.join(''));
      }
      return;
    }

    next[index] = rawVal[0] ?? '';
    onChange(next);

    // Auto-advance to next box if character was entered
    if (rawVal && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (next.every((d) => d.length === 1) && onComplete) {
      onComplete(next.join(''));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const next = [...value];
    const digits = pasted.split('');
    for (let i = 0; i < 6; i++) {
      next[i] = digits[i] || '';
    }
    onChange(next);

    const targetFocus = Math.min(digits.length, 5);
    inputsRef.current[targetFocus]?.focus();

    if (digits.length === 6 && onComplete) {
      onComplete(digits.join(''));
    }
  }

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
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
          className="h-12 w-11 sm:h-14 sm:w-13 rounded-xl border border-ink-200 bg-white text-center text-xl sm:text-2xl font-bold text-ink-900 shadow-sm transition-all focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
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

  // Stages:
  // 'credentials' -> Login form
  // 'otp' -> Login 2FA OTP
  // 'forgot_email' -> Step 1: Enter email, verify it exists, email a 6-digit code
  // 'forgot_otp' -> Step 2: Verify the code
  // 'forgot_password' -> Step 3: Set new password & confirm password, then save
  const [step, setStep] = useState<
    'credentials' | 'otp' | 'forgot_email' | 'forgot_password' | 'forgot_otp'
  >('credentials');
  // Browser Back moves to the previous step (e.g. OTP -> sign-in form)
  useStepHistory('login', step, setStep, 'credentials');

  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<{
    message: string;
    isLocked?: boolean;
    limitReached?: boolean;
    remainingAttempts?: number;
  } | null>(null);

  // OTP step states (Login)
  const [loginTicket, setLoginTicket] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Forgot password flow states
  const [resetEmail, setResetEmail] = useState('');
  const [resetTicket, setResetTicket] = useState('');
  const [verifiedTicket, setVerifiedTicket] = useState('');
  const [resetOtpDigits, setResetOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetChecking, setIsResetChecking] = useState(false);
  const [isSendingResetOtp, setIsSendingResetOtp] = useState(false);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);
  const [isResendingResetOtp, setIsResendingResetOtp] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Password rules validation for reset
  const resetRules = useMemo(
    () => ({
      length: newPassword.length >= 7,
      upper: /[A-Z]/.test(newPassword),
      lower: /[a-z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      symbol: /[^A-Za-z0-9]/.test(newPassword),
      matches: newPassword.length > 0 && newPassword === confirmPassword,
    }),
    [newPassword, confirmPassword]
  );

  const allResetRulesMet =
    resetRules.length &&
    resetRules.upper &&
    resetRules.lower &&
    resetRules.number &&
    resetRules.symbol &&
    resetRules.matches;

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

  // Listen to searchParams (e.g. from security alert email: action=forgot_password&email=...)
  useEffect(() => {
    const action = searchParams.get('action');
    const emailParam = searchParams.get('email');

    if (action === 'forgot_password' || action === 'reset_password') {
      const cleanEmail = (emailParam || email || '').trim();
      setLoginError(null);
      setSuccessBanner(null);
      setResetError(null);
      setResetEmail(cleanEmail);
      if (cleanEmail) setEmail(cleanEmail);
      setStep('forgot_email');
    } else if (emailParam && !email) {
      setEmail(emailParam.trim());
    }
  }, [searchParams]);

  // Login resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((c) => Math.max(c - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Reset password resend cooldown timer
  useEffect(() => {
    if (resetCooldown <= 0) return;
    const interval = setInterval(() => {
      setResetCooldown((c) => Math.max(c - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resetCooldown]);

  // Submit credentials -> server signs the customer in directly
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setLoginError(null);
    setSuccessBanner(null);
    try {
      const result = await initiateCustomerLogin({ email, password });

      if (result.error) {
        setIsLoading(false);
        setLoginError({
          message: result.error,
          isLocked: result.isLocked,
          limitReached: result.limitReached,
          remainingAttempts: result.remainingAttempts,
        });
        toast.error(result.error);
        return;
      }

      // ── Signed in directly (no email OTP step) ──
      // The "Signed in successfully" snackbar is shown by the destination page
      // (AuthToastNotifier reads ?login=success), so it appears after the redirect.
      // Keep the button in its "Signing in…" state until the next page opens.
      if (result.success) {
        const target = getSafeRedirect(redirectTo);
        const separator = target.includes('?') ? '&' : '?';
        router.replace(`${target}${separator}login=success`);
        return;
      }

      // Legacy fallback: an OTP step (no longer issued by the server)
      if (result.step === 'otp_required' && result.loginTicket) {
        setLoginTicket(result.loginTicket);
        setMaskedEmail(result.maskedEmail || email);
        setOtpDigits(['', '', '', '', '', '']);
        setOtpError(null);
        setCooldown(60);
        setStep('otp');
        toast.success(`Verification code sent to ${result.maskedEmail || email}`);
      }
      setIsLoading(false);
    } catch (err: any) {
      const message = err?.message || 'Unable to sign in right now. Please try again.';
      setLoginError({ message });
      toast.error(message);
      setIsLoading(false);
    }
  }

  // Step 2: Verify Login OTP -> Complete session establishment
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

  // ── Forgot Password Handlers ──

  function resetForgotState() {
    setResetError(null);
    setResetTicket('');
    setVerifiedTicket('');
    setResetOtpDigits(['', '', '', '', '', '']);
    setNewPassword('');
    setConfirmPassword('');
  }

  function handleOpenForgotPassword() {
    resetForgotState();
    setResetEmail(email.trim());
    setSuccessBanner(null);
    setLoginError(null);
    setStep('forgot_email');
  }

  // Step 1: Verify the email / username exists, then email a 6-digit code
  async function handleCheckEmailInDb(e: React.FormEvent) {
    e.preventDefault();
    const target = resetEmail.trim();
    if (!target) {
      setResetError('Please enter your email address or username.');
      return;
    }

    setIsResetChecking(true);
    setResetError(null);
    try {
      const res = await startCustomerPasswordReset(target);
      if (!res.success || !res.resetTicket) {
        const message = res.error || 'No customer account found with this email or username.';
        setResetError(message);
        toast.error(message);
        return;
      }

      if (res.email) setResetEmail(res.email);
      setResetTicket(res.resetTicket);
      setMaskedEmail(res.maskedEmail || target);
      setResetOtpDigits(['', '', '', '', '', '']);
      setResetCooldown(60);
      setStep('forgot_otp');
      toast.success(`Verification code sent to ${res.maskedEmail || target}`);
    } catch (err: any) {
      setResetError(err?.message || 'Could not verify your account. Please try again.');
    } finally {
      setIsResetChecking(false);
    }
  }

  // Resend Reset Password OTP
  async function handleResendResetOtp() {
    if (resetCooldown > 0 || !resetTicket || isResendingResetOtp) return;

    setIsResendingResetOtp(true);
    setResetError(null);
    try {
      const res = await resendCustomerResetOtpAction(resetTicket);
      if (!res.success) {
        setResetError(res.error || 'Could not resend the verification code.');
        toast.error(res.error || 'Could not resend the verification code.');
      } else {
        if (res.resetTicket) setResetTicket(res.resetTicket);
        setResetOtpDigits(['', '', '', '', '', '']);
        setResetCooldown(60);
        toast.success('A new verification code has been sent to your email.');
      }
    } catch {
      setResetError('Could not resend the verification code. Please try again in a moment.');
    } finally {
      setIsResendingResetOtp(false);
    }
  }

  // Step 2: Verify the emailed code
  async function handleVerifyResetOtp(codeToVerify?: string) {
    const code = (codeToVerify || resetOtpDigits.join('')).trim();
    if (code.length !== 6) {
      setResetError('Please enter all 6 digits of your verification code.');
      return;
    }
    if (!resetTicket || isResetSubmitting) return;

    setIsResetSubmitting(true);
    setResetError(null);
    try {
      const res = await verifyCustomerResetOtpAction(resetTicket, code);
      if (!res.success || !res.verifiedTicket) {
        setResetError(res.error || 'Invalid verification code.');
        toast.error(res.error || 'Invalid verification code.');
        return;
      }
      setVerifiedTicket(res.verifiedTicket);
      setNewPassword('');
      setConfirmPassword('');
      setStep('forgot_password');
      toast.success('Email verified. Please choose your new password.');
    } catch (err: any) {
      setResetError(err?.message || 'Could not verify your code. Please try again.');
    } finally {
      setIsResetSubmitting(false);
    }
  }

  // Step 3: Save the new password
  async function handleSaveNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!allResetRulesMet) {
      setResetError('Please fulfill all password requirements before continuing.');
      return;
    }
    if (!verifiedTicket || isSendingResetOtp) return;

    setIsSendingResetOtp(true);
    setResetError(null);
    try {
      const res = await saveCustomerResetPasswordAction({
        verifiedTicket,
        password: newPassword,
        confirmPassword,
      });
      if (!res.success) {
        setResetError(res.error || 'Failed to update password. Please try again.');
        toast.error(res.error || 'Failed to update password. Please try again.');
        return;
      }

      toast.success('Password updated successfully! Please sign in with your new password.');
      setSuccessBanner('Your password has been updated. Please sign in with your new password.');
      setEmail(resetEmail);
      setPassword('');
      setLoginError(null);
      resetForgotState();
      setStep('credentials');
    } catch (err: any) {
      setResetError(err?.message || 'Failed to update password. Please try again.');
    } finally {
      setIsSendingResetOtp(false);
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
              <span>Travinco Portal</span>
            </div>

            <h2 className="font-display text-3xl font-bold tracking-tight text-white mt-8 leading-tight">
              Seamless travel &amp; management in one place.
            </h2>
            <p className="text-sm text-ink-200 mt-3 leading-relaxed">
              Log in to review personalized travel proposals, download official invoices, or manage dashboard operations.
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
                  View itemized trip plans, hotels, and custom travel estimates tailored for you.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-3.5">
              <div className="rounded-xl bg-emerald-500/20 p-2 text-emerald-300 shrink-0">
                <Receipt className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">Verified Invoices &amp; Receipts</p>
                <p className="text-ink-300 mt-0.5">
                  Instant access to official payment receipts, GST breakdown, and booking confirmations.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Security Assurance */}
          <div className="relative z-10 pt-4 border-t border-white/10 flex items-center gap-2 text-xs text-ink-300">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>2-Step Email OTP security for your financial and booking privacy</span>
          </div>
        </div>

        {/* ── Right Column: Interactive Multi-Step Form ── */}
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center">
          <div className="w-full max-w-md mx-auto">
            {step === 'credentials' ? (
              // ── Stage 1: Unified Login Screen ──
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>Travinco Portal</span>
                  </div>
                  <Link
                    href="/"
                    className="text-xs font-medium text-ink-400 hover:text-ink-700 transition"
                  >
                    &larr; Back to Home
                  </Link>
                </div>

                <h1 className="font-display text-3xl font-bold text-ink-950 tracking-tight">
                  Sign in to Travinco
                </h1>
                <p className="mt-1.5 text-sm text-ink-500 leading-relaxed">
                  Welcome back! Please enter your details to access your account or dashboard.
                </p>

                {successBanner && (
                  <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-xs text-emerald-900 flex items-start gap-2.5 animate-in fade-in">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="font-medium leading-relaxed">{successBanner}</p>
                  </div>
                )}

                {reason && REASON_MESSAGES[reason] && (
                  <div className="mt-4 rounded-xl border border-sand-300 bg-sand-50 p-3.5 text-xs text-sand-900 flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 text-sand-700 shrink-0 mt-0.5" />
                    <p className="font-semibold">{REASON_MESSAGES[reason]}</p>
                  </div>
                )}

                {loginError && (
                  <div
                    className={`mt-4 rounded-xl border p-3 sm:p-4 text-xs sm:text-sm transition-all animate-in fade-in duration-200 ${loginError.limitReached || loginError.isLocked
                      ? 'border-red-300 bg-red-50 text-red-900 shadow-sm'
                      : typeof loginError.remainingAttempts === 'number' && loginError.remainingAttempts < 3
                        ? 'border-amber-300 bg-amber-50 text-amber-900 shadow-sm'
                        : 'border-red-200 bg-red-50 text-red-700'
                      }`}
                    role="alert"
                  >
                    <div className="flex items-start gap-2.5 sm:gap-3">
                      {loginError.limitReached || loginError.isLocked ? (
                        <ShieldAlert className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-red-600 mt-0.5" />
                      ) : typeof loginError.remainingAttempts === 'number' && loginError.remainingAttempts < 3 ? (
                        <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-amber-600 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-red-600 mt-0.5" />
                      )}
                      <div className="flex-1 space-y-1.5 min-w-0">
                        {loginError.limitReached || loginError.isLocked ? (
                          <p className="font-bold text-red-950 uppercase tracking-wide text-[11px] sm:text-xs">
                            Login Limit Reached (3 of 3 Attempts)
                          </p>
                        ) : typeof loginError.remainingAttempts === 'number' && loginError.remainingAttempts < 3 ? (
                          <p className="font-bold text-amber-950 text-[11px] sm:text-xs uppercase tracking-wide">
                            Login Attempt Failed ({3 - loginError.remainingAttempts} of 3)
                          </p>
                        ) : null}
                        <p className="leading-relaxed font-medium">{loginError.message}</p>
                        {(loginError.limitReached || loginError.isLocked) && (
                          <div className="pt-1">
                            <p className="text-[11px] sm:text-xs text-red-700 leading-snug">
                              A security alert notification has been sent to your registered email. Please reset your password to regain access to your account.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div>
                    <label className="label">
                      Email or Username <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        disabled={isLoading}
                        placeholder="you@gmail.com or username"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (loginError) setLoginError(null);
                        }}
                        className="input pl-10 pr-4 py-2.5 text-sm rounded-xl border-ink-200 focus:border-emerald-600 focus:ring-emerald-600 disabled:opacity-60 transition"
                        autoComplete="username email"
                        autoFocus
                      />
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="label mb-0">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleOpenForgotPassword}
                        disabled={isLoading}
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer disabled:opacity-60"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        disabled={isLoading}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (loginError && !loginError.limitReached) setLoginError(null);
                        }}
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
            ) : step === 'otp' ? (
              // ── Stage 2: Login OTP Verification Screen ──
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
                    className="text-xs font-medium text-ink-500 hover:text-ink-800 transition inline-flex items-center gap-1 cursor-pointer"
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
                      className={`inline-flex items-center gap-1 font-semibold transition ${cooldown > 0
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
            ) : step === 'forgot_email' ? (
              // ── Stage 3: Forgot Password Step 1: Check Email in DB ──
              <div className="animate-in fade-in duration-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                    <KeyRound className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Password Recovery</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('credentials');
                      setResetError(null);
                    }}
                    className="text-xs font-medium text-ink-500 hover:text-ink-800 transition inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to login</span>
                  </button>
                </div>

                <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-950 tracking-tight mt-2">
                  Forgot Password
                </h1>
                <p className="mt-1.5 text-sm text-ink-500 leading-relaxed">
                  Enter your registered email address or username. Once we find your account, we&apos;ll email you a 6-digit verification code.
                </p>

                <form onSubmit={handleCheckEmailInDb} className="mt-6 space-y-4">
                  <div>
                    <label className="label">
                      Email address or Username <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        disabled={isResetChecking}
                        placeholder="you@gmail.com or username"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="input pl-10 pr-4 py-2.5 text-sm rounded-xl border-ink-200 focus:border-emerald-600 focus:ring-emerald-600 disabled:opacity-60 transition"
                        autoComplete="username email"
                        autoFocus
                      />
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                    </div>
                  </div>

                  {resetError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 flex items-start gap-2.5">
                      <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">{resetError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isResetChecking || !resetEmail.trim()}
                    className="btn-primary w-full justify-center flex items-center gap-2 py-3 rounded-xl font-semibold shadow-md shadow-emerald-700/20 cursor-pointer disabled:opacity-60 hover:shadow-lg transition-all"
                  >
                    {isResetChecking ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Verifying &amp; sending code…</span>
                      </>
                    ) : (
                      <>
                        <span>Verify &amp; Send Code</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep('credentials');
                      setResetError(null);
                    }}
                    className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-800 py-2 transition cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Return to Sign in</span>
                  </button>
                </form>
              </div>
            ) : step === 'forgot_password' ? (
              // ── Stage 4: Forgot Password Step 3: Set New Password & Confirm Password ──
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Email Verified</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      resetForgotState();
                      setStep('credentials');
                    }}
                    className="text-xs font-medium text-ink-500 hover:text-ink-800 transition inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to login</span>
                  </button>
                </div>

                <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-950 tracking-tight mt-2">
                  Create New Password
                </h1>
                <p className="mt-1.5 text-sm text-ink-500 leading-relaxed">
                  Your email is verified. Choose a new password for <strong className="font-semibold text-ink-900">{resetEmail}</strong>.
                </p>

                <form onSubmit={handleSaveNewPassword} className="mt-6 space-y-4">
                  {/* New Password */}
                  <div>
                    <label className="label">
                      New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        disabled={isSendingResetOtp}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="input pl-10 pr-10 py-2.5 text-sm rounded-xl border-ink-200 focus:border-emerald-600 focus:ring-emerald-600 disabled:opacity-60 transition"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        autoFocus
                      />
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-ink-400 hover:text-ink-600 focus:outline-none cursor-pointer"
                        tabIndex={-1}
                        aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {/* Password requirements visual checklist */}
                    <div className="mt-2.5 rounded-xl border border-ink-100 bg-sand-50/60 p-3 text-xs space-y-1.5">
                      <p className="font-semibold text-ink-700 text-[11px] uppercase tracking-wider">
                        Password Requirements
                      </p>
                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                        <span
                          className={`flex items-center gap-1.5 ${resetRules.length ? 'text-emerald-700 font-medium' : 'text-ink-400'
                            }`}
                        >
                          {resetRules.length ? <Check className="h-3 w-3" /> : <Circle className="h-2.5 w-2.5" />}
                          7+ characters
                        </span>
                        <span
                          className={`flex items-center gap-1.5 ${resetRules.upper ? 'text-emerald-700 font-medium' : 'text-ink-400'
                            }`}
                        >
                          {resetRules.upper ? <Check className="h-3 w-3" /> : <Circle className="h-2.5 w-2.5" />}
                          1 capital letter
                        </span>
                        <span
                          className={`flex items-center gap-1.5 ${resetRules.lower ? 'text-emerald-700 font-medium' : 'text-ink-400'
                            }`}
                        >
                          {resetRules.lower ? <Check className="h-3 w-3" /> : <Circle className="h-2.5 w-2.5" />}
                          1 lowercase letter
                        </span>
                        <span
                          className={`flex items-center gap-1.5 ${resetRules.number ? 'text-emerald-700 font-medium' : 'text-ink-400'
                            }`}
                        >
                          {resetRules.number ? <Check className="h-3 w-3" /> : <Circle className="h-2.5 w-2.5" />}
                          1 number
                        </span>
                        <span
                          className={`flex items-center gap-1.5 col-span-2 ${resetRules.symbol ? 'text-emerald-700 font-medium' : 'text-ink-400'
                            }`}
                        >
                          {resetRules.symbol ? <Check className="h-3 w-3" /> : <Circle className="h-2.5 w-2.5" />}
                          1 special character (e.g. !@#$)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="label">
                      Confirm New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        disabled={isSendingResetOtp}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`input pl-10 pr-10 py-2.5 text-sm rounded-xl border-ink-200 focus:border-emerald-600 focus:ring-emerald-600 disabled:opacity-60 transition ${confirmPassword && !resetRules.matches
                          ? 'border-red-400 focus:ring-red-400'
                          : confirmPassword && resetRules.matches
                            ? 'border-emerald-500 focus:ring-emerald-500'
                            : ''
                          }`}
                        placeholder="••••••••"
                        autoComplete="new-password"
                      />
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-ink-400 hover:text-ink-600 focus:outline-none cursor-pointer"
                        tabIndex={-1}
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {confirmPassword && !resetRules.matches && (
                      <p className="mt-1 text-xs text-red-600">Passwords do not match.</p>
                    )}
                    {confirmPassword && resetRules.matches && (
                      <p className="mt-1 text-xs text-emerald-600 font-medium flex items-center gap-1">
                        <Check className="h-3 w-3" /> Passwords match
                      </p>
                    )}
                  </div>

                  {resetError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 flex items-start gap-2.5">
                      <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">{resetError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!allResetRulesMet || isSendingResetOtp}
                    className="btn-primary w-full justify-center flex items-center gap-2 py-3.5 rounded-xl font-semibold shadow-md shadow-emerald-700/20 cursor-pointer disabled:opacity-60 hover:shadow-lg transition-all"
                  >
                    {isSendingResetOtp ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Saving New Password…</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        <span>Save New Password</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      resetForgotState();
                      setStep('credentials');
                    }}
                    className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-800 py-2 transition cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Cancel and return to Sign in</span>
                  </button>
                </form>
              </div>
            ) : (
              // ── Stage 5: Forgot Password Step 2: Verify the emailed code ──
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Verification Code Sent</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('forgot_email');
                      setResetError(null);
                    }}
                    className="text-xs font-medium text-ink-500 hover:text-ink-800 transition inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Change email</span>
                  </button>
                </div>

                <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-950 tracking-tight mt-2">
                  Verify Your Email
                </h1>
                <p className="mt-1.5 text-sm text-ink-500 leading-relaxed">
                  We sent a 6-digit verification code to{' '}
                  <strong className="font-semibold text-ink-900">{maskedEmail}</strong>. Enter it below to continue to setting your new password.
                </p>

                <div className="mt-8">
                  <label className="label mb-2 block text-center">
                    Enter 6-Digit Code
                  </label>
                  <LoginOtpInputBoxes
                    value={resetOtpDigits}
                    onChange={setResetOtpDigits}
                    onComplete={(code) => handleVerifyResetOtp(code)}
                    disabled={isResetSubmitting}
                  />
                </div>

                {resetError && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">{resetError}</p>
                  </div>
                )}

                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={() => handleVerifyResetOtp()}
                    disabled={resetOtpDigits.join('').length !== 6 || isResetSubmitting}
                    className="btn-primary w-full justify-center flex items-center gap-2 py-3.5 rounded-xl font-semibold shadow-md shadow-emerald-700/20 cursor-pointer disabled:opacity-60 hover:shadow-lg transition-all"
                  >
                    {isResetSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Verifying…</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        <span>Verify Code</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between pt-2 text-xs text-ink-500">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('forgot_email');
                        setResetError(null);
                      }}
                      className="font-medium text-ink-600 hover:text-ink-900 hover:underline cursor-pointer"
                    >
                      Use a different email
                    </button>

                    <button
                      type="button"
                      onClick={handleResendResetOtp}
                      disabled={resetCooldown > 0 || isResendingResetOtp}
                      className={`inline-flex items-center gap-1 font-semibold transition ${resetCooldown > 0
                        ? 'text-ink-400 cursor-not-allowed'
                        : 'text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer'
                        }`}
                    >
                      <RefreshCw className={`h-3 w-3 ${isResendingResetOtp ? 'animate-spin' : ''}`} />
                      <span>{resetCooldown > 0 ? `Resend code in ${resetCooldown}s` : 'Resend code'}</span>
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
