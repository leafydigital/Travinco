'use server';

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
  remainingAttempts?: number;
  step?: 'otp_required';
  loginTicket?: string;
  maskedEmail?: string;
};

export type VerifyLoginOtpResult = {
  error?: string;
  success?: boolean;
};

/**
 * Step 1: Validates credentials using an isolated transient client
 * (NO cookies written to browser). If valid, sends a 6-digit OTP to the registered email.
 */
export async function initiateCustomerLoginFlow(
  emailInput: string,
  passwordInput: string
): Promise<InitiateLoginResult> {
  const trimmedEmail = emailInput.trim().toLowerCase();
  const password = passwordInput.trim();

  if (!trimmedEmail || !trimmedEmail.includes('@') || !password) {
    return { error: 'Please enter both your email address and password.' };
  }

  // 1. Check account lockout status
  const lockoutStatus = await checkLoginLockout(trimmedEmail, 'customer');
  if (lockoutStatus.isLocked) {
    const mins = lockoutStatus.minutesRemaining || 15;
    return {
      error: `For your security, sign in is temporarily locked after several attempts. Please try again in ${mins} minute${mins === 1 ? '' : 's'} or use "Forgot password?".`,
      isLocked: true,
      remainingAttempts: 0,
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: 'Unable to connect right now. Please try again in a moment.' };
  }

  // Transient client: Does NOT set any cookies in the user's browser!
  const transientSupabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // NO-OP: do NOT write cookies to browser during credential validation!
      },
    },
  });

  const { data: authData, error: authError } = await transientSupabase.auth.signInWithPassword({
    email: trimmedEmail,
    password,
  });

  if (authError || !authData?.user || !authData?.session) {
    if (authError?.message.toLowerCase().includes('email not confirmed')) {
      return {
        error: 'Please verify your email address first. Check your inbox for the confirmation link sent during sign up.',
      };
    }

    const attemptStatus = await recordFailedLoginAttempt(trimmedEmail, 'customer');
    if (attemptStatus.isLocked) {
      return {
        error: `For your security, sign in is temporarily locked for 15 minutes after several incorrect attempts. Please try again later or use "Forgot password?".`,
        isLocked: true,
        remainingAttempts: 0,
      };
    }

    const remaining = attemptStatus.remainingAttempts;
    return {
      error: `The email or password you entered is incorrect. You have ${remaining} attempt${remaining === 1 ? '' : 's'} left.`,
      remainingAttempts: remaining,
    };
  }

  // Check if customer account is deactivated or if staff user using anon/customer client
  try {
    const customerClient = await createCustomerClient();
    const [custRecordRes, profileRes] = await Promise.all([
      customerClient
        .from('customers')
        .select('id, is_active')
        .eq('email', trimmedEmail)
        .maybeSingle(),
      customerClient
        .from('profiles')
        .select('id, role')
        .eq('id', authData.user.id)
        .maybeSingle(),
    ]);

    if (custRecordRes.data?.is_active === false) {
      return { error: 'Your account is currently inactive. Please contact our support team.' };
    }

    const isCustomerRole =
      authData.user.user_metadata?.role === 'customer' ||
      authData.user.user_metadata?.is_customer_signup === 'true';

    if (!isCustomerRole && profileRes.data?.role) {
      return {
        error:
          'This sign in is for travellers. Staff members can sign in at the staff portal.',
      };
    }
  } catch (checkErr) {
    console.warn('Customer status check warning:', checkErr);
  }

  if (!isGmailConfigured()) {
    return {
      error: 'We could not send your verification email right now. Please try again in a few moments.',
    };
  }

  // Rate limiting on OTP requests
  const existingMem = loginOtpMemoryMap.get(trimmedEmail);
  if (existingMem && Date.now() - existingMem.createdAt < 45 * 1000) {
    return {
      error: 'Please wait a moment before requesting another verification code.',
    };
  }

  // Generate 6-digit OTP code and expiry
  const otpCode = generateOtpCode();
  const expiresAtMs = Date.now() + LOGIN_OTP_TTL_MINUTES * 60 * 1000;
  const expiresAtIso = new Date(expiresAtMs).toISOString();
  const hashedCode = hashToken(otpCode);

  // Store in memory map
  loginOtpMemoryMap.set(trimmedEmail, {
    codeHash: hashedCode,
    expiresAt: expiresAtMs,
    attempts: 0,
    createdAt: Date.now(),
  });

  // Attempt database persistence
  try {
    const serviceSupabase = createServiceClient();
    await serviceSupabase.from('enquiry_email_otps').insert({
      email: `login:${trimmedEmail}`,
      code_hash: hashedCode,
      expires_at: expiresAtIso,
      attempts: 0,
    });
  } catch (insertErr: any) {
    console.warn('Login OTP database insert warning (memory store active):', insertErr?.message);
  }

  // Encrypt the login ticket with credentials, tokens, expiry, and codeHash for seamless verification
  const loginTicket = encryptTicket({
    email: trimmedEmail,
    password,
    userId: authData.user.id,
    accessToken: authData.session.access_token,
    refreshToken: authData.session.refresh_token,
    codeHash: hashedCode,
    exp: expiresAtMs,
  });

  const fullName =
    (authData.user.user_metadata?.full_name as string) ||
    trimmedEmail.split('@')[0];

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Your Travinco Login Verification Code</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 24px; margin: 0;">
        <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="background-color: #022c22; padding: 28px 24px; text-align: center;">
            <h1 style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 700; letter-spacing: 1px;">TRAVINCO</h1>
            <p style="color: #a7f3d0; font-size: 13px; margin: 6px 0 0; text-transform: uppercase; letter-spacing: 1.5px;">Customer Account Login</p>
          </div>
          <div style="padding: 32px 28px;">
            <p style="font-size: 15px; color: #1e293b; margin: 0 0 16px; font-weight: 600;">Hello ${fullName},</p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px;">
              You have requested to sign in to your Travinco customer account. Please enter the verification code below to complete your sign-in:
            </p>
            <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #065f46; display: inline-block;">
                ${otpCode}
              </span>
              <p style="font-size: 12px; color: #047857; margin: 8px 0 0;">Valid for ${LOGIN_OTP_TTL_MINUTES} minutes</p>
            </div>
            <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0 0 8px;">
              If you did not attempt to sign in to your Travinco account, someone may have entered your email address. Please change your password or contact our support team immediately.
            </p>
          </div>
          <div style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 16px 24px; text-align: center;">
            <p style="font-size: 11px; color: #94a3b8; margin: 0;">&copy; ${new Date().getFullYear()} Travinco Tours. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const emailResult = await sendGmail({
    to: trimmedEmail,
    subject: `${otpCode} is your Travinco login verification code`,
    html,
  });

  if (emailResult.error) {
    console.error('Failed to send login verification code:', emailResult.error);
    return { error: 'Failed to send verification email. Please try again.' };
  }

  return {
    step: 'otp_required',
    loginTicket,
    maskedEmail: maskEmail(trimmedEmail),
  };
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

  return { success: true };
}
