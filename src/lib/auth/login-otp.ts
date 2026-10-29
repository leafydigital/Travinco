'use server';

import { escapeLike } from '@/lib/auth/signup-rules';
import { createServerClient } from '@supabase/ssr';
import { createCustomerClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendGmail, isGmailConfigured } from '@/lib/email/gmail';
import {
  checkLoginLockout,
  recordFailedLoginAttempt,
  clearLoginAttempts,
  MAX_LOGIN_ATTEMPTS,
} from '@/lib/auth/login-limiter';
import {
  hashToken,
  generateOtpCode,
  encryptTicket,
  decryptTicket,
  maskEmail,
} from '@/lib/auth/otp-crypto';

const LOGIN_OTP_TTL_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

type LoginOtpMemoryRecord = {
  codeHash: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
};

const loginOtpMemoryMap = new Map<string, LoginOtpMemoryRecord>();

export type InitiateLoginResult = {
  error?: string;
  isLocked?: boolean;
  limitReached?: boolean;
  remainingAttempts?: number;
  userType?: 'staff' | 'customer';
  redirectUrl?: string;
  step?: 'otp_required' | 'signed_in';
  /** True when the customer session cookie was set (no OTP step any more). */
  success?: boolean;
  loginTicket?: string;
  maskedEmail?: string;
};

export type VerifyLoginOtpResult = {
  error?: string;
  success?: boolean;
};

/**
 * Step 1: Validates credentials using an isolated transient client
 * (NO cookies written to browser). Supports login via Email OR Username.
 * If valid, sends a 6-digit OTP to the registered email.
 */
export async function initiateCustomerLoginFlow(
  identifierInput: string,
  passwordInput: string
): Promise<InitiateLoginResult> {
  const trimmedInput = (identifierInput || '').trim();
  const password = (passwordInput || '').trim();

  if (!trimmedInput || !password) {
    return { error: 'Please enter both your email or username and password.' };
  }

  const serviceSupabase = createServiceClient();
  let resolvedEmail: string | null = null;
  let userFullName: string | undefined;

  // 1. Resolve identifier: Is it an email or a username?
  if (trimmedInput.includes('@')) {
    resolvedEmail = trimmedInput.toLowerCase();
  } else {
    // Look up by username in customer_accounts table
    try {
      const { data: accountRow } = await serviceSupabase
        .from('customer_accounts')
        .select('email, full_name, username')
        .ilike('username', escapeLike(trimmedInput))
        .maybeSingle();

      if (accountRow?.email) {
        resolvedEmail = accountRow.email.toLowerCase();
        userFullName = accountRow.full_name || undefined;
      }
    } catch (lookupErr) {
      console.warn('customer_accounts username lookup notice:', lookupErr);
    }

    if (!resolvedEmail) {
      return {
        error: 'The email/username or password you entered is incorrect.',
      };
    }
  }

  // 2. Is THIS device temporarily blocked for this account? (per-device, see login-limiter)
  const lockoutStatus = await checkLoginLockout(resolvedEmail, 'customer');
  if (lockoutStatus.isLocked) {
    const mins = lockoutStatus.minutesRemaining || 15;
    return {
      error: `Too many failed attempts from this device. Please try again in ${mins} minute${mins === 1 ? '' : 's'}, or reset your password.`,
      isLocked: true,
      limitReached: true,
      remainingAttempts: 0,
    };
  }

  // 3. Sign in directly on the customer-scoped client (sets the session cookie).
  //    No email OTP step: correct username/email + password signs the customer in.
  const customerSupabase = await createCustomerClient();
  const { data: authData, error: authError } = await customerSupabase.auth.signInWithPassword({
    email: resolvedEmail,
    password,
  });

  if (authError || !authData?.user || !authData?.session) {
    if (authError?.message.toLowerCase().includes('email not confirmed')) {
      return {
        error: 'Please verify your email address first. Check your inbox for the confirmation link sent during sign up.',
      };
    }

    const attemptStatus = await recordFailedLoginAttempt(resolvedEmail, 'customer', userFullName);
    if (attemptStatus.isLocked) {
      const mins = attemptStatus.minutesRemaining || 15;
      return {
        error: `Too many failed attempts from this device. Please try again in ${mins} minute${mins === 1 ? '' : 's'}, or reset your password.`,
        isLocked: true,
        limitReached: true,
        remainingAttempts: 0,
      };
    }

    const remaining = attemptStatus.remainingAttempts;
    return {
      error: `The email/username or password you entered is incorrect. You have ${remaining} attempt${remaining === 1 ? '' : 's'} left.`,
      remainingAttempts: remaining,
    };
  }

  const userId = authData.user.id;

  // 4. Account checks (in parallel): deactivated customer, or a staff account
  try {
    const [custRecordRes, profileRes, accountRes] = await Promise.all([
      serviceSupabase.from('customers').select('id, is_active').eq('email', resolvedEmail).limit(1),
      serviceSupabase.from('profiles').select('id').eq('id', userId).maybeSingle(),
      serviceSupabase.from('customer_accounts').select('id').eq('id', userId).maybeSingle(),
    ]);

    if (custRecordRes.data?.[0]?.is_active === false) {
      await customerSupabase.auth.signOut();
      return { error: 'Your account is currently inactive. Please contact our support team.' };
    }

    if (profileRes.data && !accountRes.data) {
      // Staff accounts have their own sign-in page
      await customerSupabase.auth.signOut();
      return { error: 'This is a staff account. Please sign in at /app.' };
    }

    // Ensure customer_accounts record exists
    if (!accountRes.data) {
      await serviceSupabase.from('customer_accounts').upsert(
        {
          id: userId,
          email: resolvedEmail,
          full_name:
            (authData.user.user_metadata?.full_name as string) || userFullName || resolvedEmail.split('@')[0],
          username: (authData.user.user_metadata?.username as string) || null,
        },
        { onConflict: 'id' }
      );
    }
  } catch (checkErr) {
    console.warn('Customer status check warning:', checkErr);
  }

  // 5. Successful sign-in: reset this device's failed-attempt counter
  await clearLoginAttempts(resolvedEmail, 'customer');

  return { success: true, step: 'signed_in', userType: 'customer' };
}

/**
 * Resends a fresh login OTP for an active login ticket.
 */
export async function resendCustomerLoginOtpFlow(loginTicket: string): Promise<{
  error?: string;
  success?: boolean;
}> {
  const payload = decryptTicket<{
    email: string;
    userId: string;
    refreshToken: string;
    accessToken?: string;
    password?: string;
    codeHash: string;
    exp: number;
  }>(loginTicket);

  if (!payload || payload.exp < Date.now()) {
    return { error: 'Your session has expired. Please sign in again.' };
  }

  const trimmedEmail = payload.email.trim().toLowerCase();

  const existingMem = loginOtpMemoryMap.get(trimmedEmail);
  if (existingMem && Date.now() - existingMem.createdAt < 45 * 1000) {
    return { error: 'Please wait a moment before requesting another code.' };
  }

  const otpCode = generateOtpCode();
  const expiresAtMs = Date.now() + LOGIN_OTP_TTL_MINUTES * 60 * 1000;
  const expiresAtIso = new Date(expiresAtMs).toISOString();
  const hashedCode = hashToken(otpCode);

  loginOtpMemoryMap.set(trimmedEmail, {
    codeHash: hashedCode,
    expiresAt: expiresAtMs,
    attempts: 0,
    createdAt: Date.now(),
  });

  try {
    const serviceSupabase = createServiceClient();
    await serviceSupabase.from('enquiry_email_otps').insert({
      email: `login:${trimmedEmail}`,
      code_hash: hashedCode,
      expires_at: expiresAtIso,
      attempts: 0,
    });
  } catch {}

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 24px;">
        <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 28px; text-align: center;">
          <h2 style="color: #022c22; margin: 0 0 16px;">TRAVINCO</h2>
          <p style="color: #475569; font-size: 14px; margin: 0 0 20px;">Here is your requested sign-in verification code:</p>
          <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 18px; margin: 0 0 20px;">
            <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #065f46;">${otpCode}</span>
          </div>
          <p style="font-size: 12px; color: #64748b;">Valid for ${LOGIN_OTP_TTL_MINUTES} minutes.</p>
        </div>
      </body>
    </html>
  `;

  const emailResult = await sendGmail({
    to: trimmedEmail,
    subject: `${otpCode} is your new Travinco verification code`,
    html,
  });

  if (emailResult.error) {
    return { error: 'Could not send the verification email. Please try again.' };
  }

  return { success: true };
}

/**
 * Step 2: Verifies the entered OTP and establishes the authenticated customer session
 * by committing the sb-customer-auth-token cookies to the browser.
 */
export async function verifyCustomerLoginOtpFlow(
  loginTicket: string,
  enteredOtp: string
): Promise<VerifyLoginOtpResult> {
  const payload = decryptTicket<{
    email: string;
    userId: string;
    refreshToken: string;
    accessToken?: string;
    password?: string;
    codeHash: string;
    exp: number;
  }>(loginTicket);

  if (!payload || payload.exp < Date.now()) {
    return { error: 'Your sign-in request took too long. Please sign in again.' };
  }

  const trimmedOtp = enteredOtp.trim();
  if (trimmedOtp.length !== 6) {
    return { error: 'Please enter the 6-digit verification code.' };
  }

  const computedHash = hashToken(trimmedOtp);
  const trimmedEmail = payload.email.trim().toLowerCase();
  let verified = false;

  // 1. Try DB verification if record exists
  try {
    const serviceSupabase = createServiceClient();
    const loginOtpKey = `login:${trimmedEmail}`;

    const { data: record } = await serviceSupabase
      .from('enquiry_email_otps')
      .select('*')
      .eq('email', loginOtpKey)
      .is('verified_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (record) {
      if (new Date(record.expires_at) < new Date()) {
        return { error: 'This verification code has expired. Please request a new code.' };
      }
      if (record.attempts >= MAX_OTP_ATTEMPTS) {
        return { error: 'Too many incorrect attempts. Please sign in again to receive a fresh code.' };
      }

      if (computedHash === record.code_hash) {
        verified = true;
        await serviceSupabase
          .from('enquiry_email_otps')
          .update({ verified_at: new Date().toISOString() })
          .eq('id', record.id);
      } else {
        const nextAttempts = record.attempts + 1;
        await serviceSupabase
          .from('enquiry_email_otps')
          .update({ attempts: nextAttempts })
          .eq('id', record.id);

        const remaining = MAX_OTP_ATTEMPTS - nextAttempts;
        return { error: `Incorrect verification code. You have ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` };
      }
    }
  } catch {}

  // 2. Check ticket & memory store fallback
  if (!verified) {
    const memRecord = loginOtpMemoryMap.get(trimmedEmail);
    const expectedHash = memRecord?.codeHash || payload.codeHash;

    if (expectedHash && computedHash === expectedHash) {
      verified = true;
      loginOtpMemoryMap.delete(trimmedEmail);
    } else {
      return { error: 'Incorrect verification code. Please check your email and try again.' };
    }
  }

  // Clear failed login attempts lockout record
  await clearLoginAttempts(payload.email, 'customer');

  // Establish the authenticated customer session via scoped client
  const customerSupabase = await createCustomerClient();
  let sessionEstablished = false;
  let sessionIssue: any = null;

  // Method A: Sign in directly on customer client with verified credentials
  if (payload.password) {
    try {
      const { data: signInData, error: signInErr } = await customerSupabase.auth.signInWithPassword({
        email: payload.email,
        password: payload.password,
      });
      if (!signInErr && signInData?.session) {
        sessionEstablished = true;
      } else if (signInErr) {
        sessionIssue = signInErr;
        console.warn('Customer client signInWithPassword notice:', signInErr.message);
      }
    } catch (err: any) {
      sessionIssue = err;
    }
  }

  // Method B: Set session with access token + refresh token
  if (!sessionEstablished && payload.accessToken && payload.refreshToken) {
    try {
      const { data: setData, error: setErr } = await customerSupabase.auth.setSession({
        access_token: payload.accessToken,
        refresh_token: payload.refreshToken,
      });
      if (!setErr && setData?.session) {
        sessionEstablished = true;
      } else if (setErr) {
        sessionIssue = setErr;
        console.warn('Customer client setSession notice:', setErr.message);
      }
    } catch (err: any) {
      sessionIssue = err;
    }
  }

  // Method C: Refresh session using refresh token
  if (!sessionEstablished && payload.refreshToken) {
    try {
      const { data: refData, error: refErr } = await customerSupabase.auth.refreshSession({
        refresh_token: payload.refreshToken,
      });
      if (!refErr && refData?.session) {
        sessionEstablished = true;
      } else if (refErr) {
        sessionIssue = refErr;
        console.warn('Customer client refreshSession notice:', refErr.message);
      }
    } catch (err: any) {
      sessionIssue = err;
    }
  }

  if (!sessionEstablished) {
    console.error('All customer session establishment attempts failed:', sessionIssue);
    return { error: 'We were unable to sign you in. Please check your details and try again.' };
  }

  // Ensure customer_accounts record exists
  try {
    const { data: existingAccount } = await customerSupabase
      .from('customer_accounts')
      .select('id')
      .eq('id', payload.userId)
      .maybeSingle();

    if (!existingAccount) {
      await customerSupabase.from('customer_accounts').upsert(
        {
          id: payload.userId,
          email: payload.email,
          full_name: payload.email.split('@')[0],
        },
        { onConflict: 'id' }
      );
    }
  } catch (syncErr) {
    console.warn('Sync customer_accounts warning:', syncErr);
  }

  // Clear failed login attempts counter on successful login
  await clearLoginAttempts(payload.email, 'customer');

  return { success: true };
}
