'use client';

import { useState, useTransition, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  KeyRound,
  X,
  Eye,
  EyeOff,
  Check,
  Circle,
  Loader2,
  ShieldCheck,
  AlertCircle,
  User,
  ArrowLeft,
} from 'lucide-react';
import { toast } from '@/lib/admin-alert';
import { resetStaffPasswordAction, verifyOwnAccountIdentifier } from '@/app/travinco_dashboard/actions';

interface ResetPasswordModalProps {
  userEmail?: string;
  variant?: 'dashboard' | 'sidebar';
  className?: string;
}

export function ResetPasswordModal({
  userEmail,
  variant = 'dashboard',
  className = '',
}: ResetPasswordModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  // Step 1: confirm username / email -> Step 2: new password + confirm
  const [step, setStep] = useState<'identify' | 'password'>('identify');
  const [identifier, setIdentifier] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  const rules = useMemo(
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

  const allRulesMet =
    rules.length &&
    rules.upper &&
    rules.lower &&
    rules.number &&
    rules.symbol &&
    rules.matches;

  const handleOpen = () => {
    setStep('identify');
    setIdentifier('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setErrorMessage(null);
    setIsOpen(true);
  };

  const handleClose = useCallback(() => {
    if (isPending) return;
    setIsOpen(false);
    setErrorMessage(null);
  }, [isPending]);

  // Close modal when Escape key is pressed
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPending, handleClose]);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || isPending) return;

    setErrorMessage(null);
    startTransition(async () => {
      const res = await verifyOwnAccountIdentifier(identifier);
      if (res?.error) {
        setErrorMessage(res.error);
        return;
      }
      setNewPassword('');
      setConfirmPassword('');
      setStep('password');
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRulesMet || isPending) return;

    setErrorMessage(null);
    startTransition(async () => {
      const res = await resetStaffPasswordAction({
        identifier,
        password: newPassword,
        confirmPassword,
      });

      if (res?.error) {
        setErrorMessage(res.error);
        toast.error(res.error);
      } else {
        toast.success('Your password has been reset successfully!');
        handleClose();
      }
    });
  };

  const modalDialog = isOpen ? (
    <div
      className="fixed inset-0 bg-ink-950/50 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) {
          handleClose();
        }
      }}
    >
      {/* Card Container */}
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-lg shadow-ink-900/5 border border-ink-100 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
            {/* Close Button */}
            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition cursor-pointer disabled:opacity-50"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>
  
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-4 ring-brand-50/50">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-ink-900">
                  Reset Account Password
                </h3>
                <p className="text-xs text-ink-500">
                  {step === 'identify'
                    ? 'Step 1 of 2 — enter your username or email to continue'
                    : 'Step 2 of 2 — choose your new password'}
                </p>
              </div>
            </div>
  
            {/* Error Message */}
            {errorMessage && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-coral-50 border border-coral-200 px-3 py-2 text-xs text-coral-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-coral-600" />
                <span>{errorMessage}</span>
              </div>
            )}
  
            {/* Step 1: verify username / email */}
            {step === 'identify' && (
              <form onSubmit={handleVerify} className="mt-5 space-y-4" noValidate>
                <div>
                  <label htmlFor="reset-identifier" className="block text-xs font-semibold text-ink-700 mb-1">
                    Username / Email <span className="text-coral-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="reset-identifier"
                      type="text"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="Username or email"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      autoFocus
                      required
                      disabled={isPending}
                      className="w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2 pl-9 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 transition"
                    />
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-ink-100">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isPending}
                    className="rounded-lg px-3.5 py-2 text-xs font-semibold text-ink-600 hover:bg-ink-100 transition cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!identifier.trim() || isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-brand-700 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50 transition cursor-pointer"
                  >
                    {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>{isPending ? 'Verifying...' : 'Verify'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Step 2: new password + confirm */}
            {step === 'password' && (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  New Password <span className="text-coral-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    disabled={isPending}
                    className="w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2 pr-10 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ink-400 hover:text-ink-600 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
  
              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Confirm New Password <span className="text-coral-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    disabled={isPending}
                    className="w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2 pr-10 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ink-400 hover:text-ink-600 cursor-pointer"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
  
              {/* Password Requirements Checklist */}
              <div className="rounded-xl bg-ink-50/70 border border-ink-100 p-3 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-1">
                  Password Requirements:
                </p>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <div
                    className={`flex items-center gap-1.5 transition-colors ${
                      rules.length ? 'text-emerald-700 font-medium' : 'text-ink-400'
                    }`}
                  >
                    {rules.length ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-ink-300 shrink-0" />
                    )}
                    <span>7+ characters</span>
                  </div>
  
                  <div
                    className={`flex items-center gap-1.5 transition-colors ${
                      rules.upper ? 'text-emerald-700 font-medium' : 'text-ink-400'
                    }`}
                  >
                    {rules.upper ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-ink-300 shrink-0" />
                    )}
                    <span>Uppercase (A-Z)</span>
                  </div>
  
                  <div
                    className={`flex items-center gap-1.5 transition-colors ${
                      rules.lower ? 'text-emerald-700 font-medium' : 'text-ink-400'
                    }`}
                  >
                    {rules.lower ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-ink-300 shrink-0" />
                    )}
                    <span>Lowercase (a-z)</span>
                  </div>
  
                  <div
                    className={`flex items-center gap-1.5 transition-colors ${
                      rules.number ? 'text-emerald-700 font-medium' : 'text-ink-400'
                    }`}
                  >
                    {rules.number ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-ink-300 shrink-0" />
                    )}
                    <span>Number (0-9)</span>
                  </div>
  
                  <div
                    className={`flex items-center gap-1.5 transition-colors ${
                      rules.symbol ? 'text-emerald-700 font-medium' : 'text-ink-400'
                    }`}
                  >
                    {rules.symbol ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-ink-300 shrink-0" />
                    )}
                    <span>Symbol (!@#$%)</span>
                  </div>
  
                  <div
                    className={`flex items-center gap-1.5 transition-colors ${
                      rules.matches ? 'text-emerald-700 font-medium' : 'text-ink-400'
                    }`}
                  >
                    {rules.matches ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-ink-300 shrink-0" />
                    )}
                    <span>Passwords match</span>
                  </div>
                </div>
              </div>
  
              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-ink-100">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setStep('identify');
                  }}
                  disabled={isPending}
                  className="mr-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold text-ink-500 hover:bg-ink-100 transition cursor-pointer disabled:opacity-50"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isPending}
                  className="rounded-lg px-3.5 py-2 text-xs font-semibold text-ink-600 hover:bg-ink-100 transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!allRulesMet || isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-brand-700 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50 transition cursor-pointer"
                >
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isPending ? 'Updating...' : 'Save New Password'}</span>
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      ) : null;

  return (
    <>
      {/* Trigger Button */}
      {variant === 'dashboard' ? (
        <button
          type="button"
          onClick={handleOpen}
          className={`inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-2xs hover:bg-brand-50 hover:border-brand-300 transition-colors cursor-pointer ${className}`}
          title="Reset your account password"
        >
          <KeyRound className="h-3.5 w-3.5 text-brand-600" />
          <span>Reset Password</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-ink-100 hover:text-ink-900 transition-colors cursor-pointer ${className}`}
          title="Reset your account password"
        >
          <KeyRound className="h-4 w-4 text-ink-500" />
          <span>Reset Password</span>
        </button>
      )}

      {/* Render modal in document.body via Portal so it never gets trapped inside sidebar */}
      {mounted && typeof document !== 'undefined' && modalDialog
        ? createPortal(modalDialog, document.body)
        : null}
    </>
  );
}
