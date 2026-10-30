import { createCustomerClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendGmail, isGmailConfigured } from '@/lib/email/gmail';
import {
  hashToken,
  generateOtpCode,
  encryptTicket,
  decryptTicket,
  maskEmail,
} from '@/lib/auth/otp-crypto';
import {
  escapeLike,
  validateEmailFormat,
  validateUsernameFormat,
} from '@/lib/auth/signup-rules';
import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js/mobile';

/** Escapes user-supplied text placed into email HTML (usernames may contain any non-space chars). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SIGNUP_OTP_TTL_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

type SignupOtpMemoryRecord = {
  codeHash: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
};

const signupOtpMemoryMap = new Map<string, SignupOtpMemoryRecord>();

export type InitiateSignupResult = {
  error?: string;
  signupTicket?: string;
  maskedEmail?: string;
};

export type VerifySignupResult = {
  error?: string;
  success?: boolean;
  /** True when the new customer was signed in automatically (session cookie set). */
  signedIn?: boolean;
};

/**
 * Checks whether a username is already taken (case-insensitive, matched literally).
 * customer_accounts is the source of truth for customer usernames (kept in sync on
 * signup), so the old full auth.users scan (listUsers) is no longer needed: it
 * downloaded every user on each check and was the main cause of slow signups.
 */
export async function isUsernameAlreadyTaken(username: string): Promise<boolean> {
  const trimmed = username.trim();
  if (!trimmed) return false;

  try {
    const serviceSupabase = createServiceClient();
    const { data } = await serviceSupabase
      .from('customer_accounts')
      .select('id')
      .ilike('username', escapeLike(trimmed))
      .limit(1);
    return Boolean(data && data.length > 0);
  } catch (err) {
    console.warn('isUsernameAlreadyTaken check notice:', err);
    return false;
  }
}

/**
 * Checks whether an email already belongs to an ACCOUNT (customer account or staff profile).
 * Rows in `customers` alone are NOT accounts: they are also created by website enquiries,
 * so checking them blocked anyone who had ever enquired from signing up.
 */
async function isEmailAlreadyTaken(email: string): Promise<boolean> {
  const trimmedEmail = email.trim().toLowerCase();
  try {
    const serviceSupabase = createServiceClient();
    const [accountRes, profileRes] = await Promise.all([
      serviceSupabase.from('customer_accounts').select('id').ilike('email', escapeLike(trimmedEmail)).limit(1),
      serviceSupabase.from('profiles').select('id').ilike('email', escapeLike(trimmedEmail)).limit(1),
    ]);
    return Boolean(accountRes.data?.length || profileRes.data?.length);
  } catch (checkErr) {
    console.warn('isEmailAlreadyTaken check notice:', checkErr);
    return false;
  }
}

/** Formats a stored phone may be in (E.164, digits with/without +, national, 0-prefixed). */
export function phoneVariants(e164: string): string[] {
  const parsed = parsePhoneNumberFromString(e164);
  const variants = new Set<string>([e164, e164.replace(/^\+/, '')]);
  if (parsed) {
    variants.add(parsed.nationalNumber);
    variants.add(`0${parsed.nationalNumber}`);
    variants.add(`${parsed.countryCallingCode}${parsed.nationalNumber}`);
  }
  return Array.from(variants);
}

/**
 * Checks whether a mobile number already belongs to an ACCOUNT: a staff profile, or a
 * `customers` row whose email has a customer account (enquiry-only rows don't count).
 */
export async function isPhoneAlreadyTaken(e164Phone: string): Promise<boolean> {
  if (!e164Phone) return false;
  try {
    const serviceSupabase = createServiceClient();
    const variants = phoneVariants(e164Phone);
    const [customersRes, profilesRes] = await Promise.all([
      serviceSupabase.from('customers').select('email').in('phone', variants).limit(50),
      serviceSupabase.from('profiles').select('id').in('phone', variants).limit(1),
    ]);
    if (profilesRes.data?.length) return true;

    const emails = Array.from(
      new Set(
        (customersRes.data ?? [])
          .map((c: { email: string | null }) => c.email?.toLowerCase())
          .filter(Boolean)
      )
    ) as string[];
    if (emails.length === 0) return false;

    const { data: accounts } = await serviceSupabase
      .from('customer_accounts')
      .select('id')
      .in('email', emails)
      .limit(1);
    return Boolean(accounts && accounts.length > 0);
  } catch (err) {
    console.warn('isPhoneAlreadyTaken check notice:', err);
    return false;
  }
}

export type SignupAvailability = {
  username?: string | null;
  email?: string | null;
  phone?: string | null;
};

/**
 * Live availability check for the signup form (called on field blur), so visitors
 * learn "already exists" immediately instead of after submitting. Runs checks in parallel.
 */
export async function checkSignupAvailabilityFlow(input: {
  username?: string;
  email?: string;
  phone?: string;
}): Promise<SignupAvailability> {
  const result: SignupAvailability = {};
  const tasks: Promise<void>[] = [];

  if (input.username !== undefined) {
    const fmt = validateUsernameFormat(input.username);
    if (fmt) result.username = fmt;
    else
      tasks.push(
        isUsernameAlreadyTaken(input.username).then((taken) => {
          result.username = taken ? 'Username is already taken' : null;
        })
      );
  }
  if (input.email !== undefined) {
    const fmt = validateEmailFormat(input.email);
    if (fmt) result.email = fmt;
    else
      tasks.push(
        isEmailAlreadyTaken(input.email).then((taken) => {
          result.email = taken ? 'An account with this email already exists' : null;
        })
      );
  }
  if (input.phone !== undefined) {
    if (!input.phone || !isValidPhoneNumber(input.phone)) result.phone = 'Enter a valid mobile number';
    else
      tasks.push(
        isPhoneAlreadyTaken(input.phone).then((taken) => {
          result.phone = taken ? 'An account with this mobile number already exists' : null;
        })
      );
  }

  await Promise.all(tasks);
  return result;
}

/**
 * Step 1: Validates signup details, username uniqueness, checks for duplicate email, and sends a 6-digit OTP.
 */
export async function initiateCustomerSignupFlow(params: {
  fullName: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}): Promise<InitiateSignupResult> {
  const fullName = params.fullName.trim();
  const username = (params.username || '').trim();
  const email = params.email.trim().toLowerCase();
  const phoneParsed = parsePhoneNumberFromString((params.phone || '').trim());
  const phone = phoneParsed?.number ?? '';
  const password = params.password.trim();
  const confirmPassword = params.confirmPassword.trim();

  if (!fullName) {
    return { error: 'Please enter your full name.' };
  }

  const usernameFormatError = validateUsernameFormat(params.username || '');
  if (usernameFormatError) {
    return { error: `${usernameFormatError}.` };
  }

  const emailFormatError = validateEmailFormat(email);
  if (emailFormatError) {
    return { error: `${emailFormatError}.` };
  }

  if (!phone || !isValidPhoneNumber(phone)) {
    return { error: 'Enter a valid mobile number.' };
  }

  if (password.length < 7) {
    return { error: 'Password must be at least 7 characters long.' };
  }

  if (!/[A-Z]/.test(password)) {
    return { error: 'Password must include at least one capital letter (A-Z).' };
  }

  if (!/[a-z]/.test(password)) {
    return { error: 'Password must include at least one lowercase letter (a-z).' };
  }

  if (!/[0-9]/.test(password)) {
    return { error: 'Password must include at least one number (0-9).' };
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return { error: 'Password must include at least one special symbol (e.g. !@#$%).' };
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }

  // Duplicate checks (username, email, mobile) in parallel
  const [usernameTaken, emailTaken, phoneTaken] = await Promise.all([
    isUsernameAlreadyTaken(username),
    isEmailAlreadyTaken(email),
    isPhoneAlreadyTaken(phone),
  ]);
  if (usernameTaken) return { error: 'Username is already taken' };
  if (emailTaken) return { error: 'An account with this email already exists' };
  if (phoneTaken) return { error: 'An account with this mobile number already exists' };

  if (!isGmailConfigured()) {
    return {
      error: 'We could not send your verification email right now. Please try again in a few moments.',
    };
  }

  // Rate limiting: 45 seconds between requests
  const existingMem = signupOtpMemoryMap.get(email);
  if (existingMem && Date.now() - existingMem.createdAt < 45 * 1000) {
    return {
      error: 'Please wait a moment before requesting another verification code.',
    };
  }

  const otpCode = generateOtpCode();
  const expiresAtMs = Date.now() + SIGNUP_OTP_TTL_MINUTES * 60 * 1000;
  const expiresAtIso = new Date(expiresAtMs).toISOString();
  const hashedCode = hashToken(otpCode);

  // Store in memory map
  signupOtpMemoryMap.set(email, {
    codeHash: hashedCode,
    expiresAt: expiresAtMs,
    attempts: 0,
    createdAt: Date.now(),
  });

  // Store in database (fallback store), in parallel with sending the email below
  const otpInsert = (async () => {
    try {
      const serviceSupabase = createServiceClient();
      await serviceSupabase.from('enquiry_email_otps').insert({
        email: `signup:${email}`,
        code_hash: hashedCode,
        expires_at: expiresAtIso,
        attempts: 0,
      });
    } catch (dbErr: any) {
      console.warn('Signup OTP database insert notice (memory store active):', dbErr?.message);
    }
  })();

  // Encrypt the signup ticket (AES-256-GCM) with validated registration details including username
  const signupTicket = encryptTicket({
    fullName,
    username,
    email,
    phone,
    password,
    codeHash: hashedCode,
    exp: expiresAtMs,
  });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Your Travinco Account Verification Code</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 24px; margin: 0;">
        <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="background-color: #022c22; padding: 28px 24px; text-align: center;">
            <h1 style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 700; letter-spacing: 1px;">TRAVINCO</h1>
            <p style="color: #a7f3d0; font-size: 13px; margin: 6px 0 0; text-transform: uppercase; letter-spacing: 1.5px;">Curated Holidays &amp; Travel Concierge</p>
          </div>
          <div style="padding: 32px 28px;">
            <p style="font-size: 15px; color: #1e293b; margin: 0 0 16px; font-weight: 600;">Hi ${escapeHtml(fullName)},</p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px;">
              Thank you for creating your account with Travinco. Your chosen username is <strong>@${escapeHtml(username)}</strong>. Please enter the verification code below to verify your email and activate your account:
            </p>
            <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #065f46; display: inline-block;">
                ${otpCode}
              </span>
              <p style="font-size: 12px; color: #047857; margin: 8px 0 0;">Valid for ${SIGNUP_OTP_TTL_MINUTES} minutes</p>
            </div>
            <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0 0 8px;">
              Do not share this code with anyone. If you didn't create an account on Travinco, you can safely ignore this email.
            </p>
          </div>
          <div style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 16px 24px; text-align: center;">
            <p style="font-size: 11px; color: #94a3b8; margin: 0;">&copy; ${new Date().getFullYear()} Travinco Tours. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const [emailResult] = await Promise.all([
    sendGmail({
      to: email,
      subject: `${otpCode} is your Travinco sign-up verification code`,
      html,
    }),
    otpInsert,
  ]);

  if (emailResult.error) {
    console.error('Failed to send verification code email:', emailResult.error);
    return {
      error: 'We could not send your verification code. Please check your email and try again.',
    };
  }

  return {
    signupTicket,
    maskedEmail: maskEmail(email),
  };
}

/**
 * Resends a fresh 6-digit verification code for an existing pending signup session.
 */
export async function resendCustomerSignupOtpFlow(
  signupTicket: string
): Promise<{ error?: string; success?: boolean }> {
  const payload = decryptTicket<{
    fullName: string;
    username: string;
    email: string;
    phone?: string;
    password: string;
    codeHash: string;
    exp: number;
  }>(signupTicket);

  if (!payload || payload.exp < Date.now()) {
    return { error: 'Your signup session has expired. Please fill out the form again.' };
  }

  const trimmedEmail = payload.email.trim().toLowerCase();

  const existingMem = signupOtpMemoryMap.get(trimmedEmail);
  if (existingMem && Date.now() - existingMem.createdAt < 45 * 1000) {
    return { error: 'Please wait a moment before requesting another verification code.' };
  }

  const otpCode = generateOtpCode();
  const expiresAtMs = Date.now() + SIGNUP_OTP_TTL_MINUTES * 60 * 1000;
  const expiresAtIso = new Date(expiresAtMs).toISOString();
  const hashedCode = hashToken(otpCode);

  signupOtpMemoryMap.set(trimmedEmail, {
    codeHash: hashedCode,
    expiresAt: expiresAtMs,
    attempts: 0,
    createdAt: Date.now(),
  });

  try {
    const serviceSupabase = createServiceClient();
    await serviceSupabase.from('enquiry_email_otps').insert({
      email: `signup:${trimmedEmail}`,
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
          <p style="color: #475569; font-size: 14px; margin: 0 0 20px;">Here is your new sign-up verification code:</p>
          <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 18px; margin: 0 0 20px;">
            <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #065f46;">${otpCode}</span>
          </div>
          <p style="font-size: 12px; color: #64748b;">Valid for ${SIGNUP_OTP_TTL_MINUTES} minutes.</p>
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
 * Step 2: Verifies the entered 6-digit OTP, creates the confirmed user account,
 * synchronizes customer records, and sends the welcome confirmation email.
 */
export async function verifyCustomerSignupOtpFlow(
  signupTicket: string,
  enteredOtp: string
): Promise<VerifySignupResult> {
  const payload = decryptTicket<{
    fullName: string;
    username: string;
    email: string;
    phone?: string;
    password: string;
    codeHash: string;
    exp: number;
  }>(signupTicket);

  if (!payload || payload.exp < Date.now()) {
    return { error: 'Your signup session has expired. Please start over.' };
  }

  const trimmedOtp = enteredOtp.trim();
  if (trimmedOtp.length !== 6) {
    return { error: 'Please enter all 6 digits of your verification code.' };
  }

  const trimmedEmail = payload.email.trim().toLowerCase();
  const computedHash = hashToken(trimmedOtp);
  let verified = false;

  // 1. Check database OTP record first
  try {
    const serviceSupabase = createServiceClient();
    const { data: record } = await serviceSupabase
      .from('enquiry_email_otps')
      .select('id, code_hash, expires_at, attempts')
      .eq('email', `signup:${trimmedEmail}`)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (record) {
      if (record.attempts >= MAX_OTP_ATTEMPTS) {
        return { error: 'Too many incorrect attempts. Please request a new verification code.' };
      }

      if (record.code_hash === computedHash) {
        verified = true;
        await serviceSupabase
          .from('enquiry_email_otps')
          .delete()
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
    const memRecord = signupOtpMemoryMap.get(trimmedEmail);
    const expectedHash = memRecord?.codeHash || payload.codeHash;

    if (expectedHash && computedHash === expectedHash) {
      verified = true;
      signupOtpMemoryMap.delete(trimmedEmail);
    } else {
      return { error: 'Incorrect verification code. Please check your email and try again.' };
    }
  }

  // 3. Create the user account with email_confirm: true (No confirmation link sent!)
  const serviceSupabase = createServiceClient();
  const { data: authData, error: createError } = await serviceSupabase.auth.admin.createUser({
    email: trimmedEmail,
    password: payload.password,
    email_confirm: true,
    user_metadata: {
      full_name: payload.fullName,
      username: payload.username,
      phone: payload.phone || null,
      role: 'customer',
      is_customer_signup: 'true',
    },
  });

  if (createError) {
    const msg = createError.message.toLowerCase();
    if (
      msg.includes('already registered') ||
      msg.includes('already exists') ||
      msg.includes('user already')
    ) {
      return { error: 'Email is already taken' };
    }
    console.error('verifyCustomerSignupOtpFlow createUser error:', createError);
    return { error: 'Could not create your account. Please try again.' };
  }

  const userId = authData.user.id;

  // 4. Synchronize customer_accounts and customers tables
  try {
    await serviceSupabase.from('customer_accounts').upsert(
      {
        id: userId,
        full_name: payload.fullName,
        username: payload.username,
        email: trimmedEmail,
      },
      { onConflict: 'id' }
    );

    const { data: existingRows } = await serviceSupabase
      .from('customers')
      .select('id, phone')
      .eq('email', trimmedEmail)
      .limit(1);
    const existingCust = existingRows?.[0];

    if (!existingCust) {
      await serviceSupabase.from('customers').insert({
        full_name: payload.fullName,
        email: trimmedEmail,
        phone: payload.phone || '',
        source: 'website',
        is_active: true,
        is_deleted: false,
      } as any);
    } else if (payload.phone && !existingCust.phone) {
      // Customer record from an earlier enquiry: store the verified mobile number
      await serviceSupabase.from('customers').update({ phone: payload.phone }).eq('id', existingCust.id);
    }
  } catch (syncErr) {
    console.warn('Customer account sync notice:', syncErr);
  }

  // 4b. Sign the new customer in straight away (sets the customer session cookie),
  // so they land on My Bookings instead of having to log in again.
  let signedIn = false;
  try {
    const customerSupabase = await createCustomerClient();
    const { data: signInData, error: signInErr } = await customerSupabase.auth.signInWithPassword({
      email: trimmedEmail,
      password: payload.password,
    });
    signedIn = !signInErr && Boolean(signInData?.session);
    if (signInErr) console.warn('Post-signup auto sign-in notice:', signInErr.message);
  } catch (signInEx) {
    console.warn('Post-signup auto sign-in notice:', signInEx);
  }

  // 5. Send rich "Account Created" welcome confirmation email to user's inbox
  try {
    const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://travinco.in').replace(/\/+$/, '');
    const loginUrl = `${baseUrl}/account/login`;
    const welcomeHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to Travinco</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 24px; margin: 0;">
          <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden;">
            <div style="background-color: #022c22; padding: 28px 24px; text-align: center;">
              <h1 style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 700; letter-spacing: 1px;">TRAVINCO</h1>
              <p style="color: #a7f3d0; font-size: 13px; margin: 6px 0 0; text-transform: uppercase; letter-spacing: 1.5px;">Travel Solutions</p>
            </div>
            <div style="padding: 32px 28px; color: #334155; font-size: 14px; line-height: 1.7;">
              <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; font-weight: 600;">Dear ${escapeHtml(payload.fullName)},</p>
              <p style="margin: 0 0 16px;">
                You've successfully registered on <strong>Travinco - Travel Solutions</strong>.
              </p>
              <p style="margin: 0 0 8px;">With your account you can:</p>
              <ul style="margin: 0 0 20px; padding-left: 20px;">
                <li>Explore our holiday packages</li>
                <li>See the enquiries you've made</li>
                <li>View and download your invoices</li>
              </ul>
              <p style="margin: 0 0 12px;">You can access your account using the link below:</p>
              <p style="margin: 0 0 20px; text-align: center;">
                <a href="${loginUrl}" style="display: inline-block; background-color: #047857; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 28px; border-radius: 10px;">Sign in to your account</a>
              </p>
              <p style="margin: 0 0 20px; font-size: 13px; color: #64748b; word-break: break-all;">
                ${loginUrl}
              </p>
              <div style="background-color: #f1f5f9; border-radius: 12px; padding: 16px 18px; margin: 0 0 24px;">
                <p style="margin: 0 0 4px; font-size: 13px; color: #475569;">Sign in with your registered <strong>username</strong> or <strong>email</strong> and your password:</p>
                <p style="margin: 0; font-size: 13px; color: #0f172a;">Username: <strong>${escapeHtml(payload.username)}</strong><br>Email: <strong>${trimmedEmail}</strong></p>
              </div>
              <p style="margin: 0;">Thanks,<br><strong>Team Travinco</strong></p>
            </div>
            <div style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 16px 24px; text-align: center;">
              <p style="font-size: 11px; color: #94a3b8; margin: 0;">&copy; ${new Date().getFullYear()} Travinco - Travel Solutions. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await sendGmail({
      to: trimmedEmail,
      subject: `Welcome to Travinco - Travel Solutions, ${payload.fullName}!`,
      html: welcomeHtml,
    });
  } catch (emailErr) {
    console.warn('Welcome email delivery notice:', emailErr);
  }

  return { success: true, signedIn };
}
