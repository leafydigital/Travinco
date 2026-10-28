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
};

/**
 * Checks whether a username is already taken in customer_accounts or auth.users metadata.
 */
export async function isUsernameAlreadyTaken(username: string): Promise<boolean> {
  const trimmed = username.trim().toLowerCase();
  if (!trimmed) return false;

  try {
    const serviceSupabase = createServiceClient();
    const { data: accountData } = await serviceSupabase
      .from('customer_accounts')
      .select('id')
      .ilike('username', trimmed)
      .maybeSingle();

    if (accountData) return true;

    // Fallback check against auth users metadata
    const { data: usersData } = await serviceSupabase.auth.admin.listUsers();
    const match = usersData?.users?.some(
      (u) => (u.user_metadata?.username as string)?.toLowerCase() === trimmed
    );
    if (match) return true;
  } catch (err) {
    console.warn('isUsernameAlreadyTaken check notice:', err);
  }

  return false;
}

/**
 * Checks whether an email is already registered in customer_accounts, customers, or profiles.
 */
async function isEmailAlreadyTaken(email: string): Promise<boolean> {
  const trimmedEmail = email.trim().toLowerCase();
  try {
    const serviceSupabase = createServiceClient();
    const [accountRes, customerRes, profileRes] = await Promise.all([
      serviceSupabase
        .from('customer_accounts')
        .select('id')
        .eq('email', trimmedEmail)
        .maybeSingle(),
      serviceSupabase
        .from('customers')
        .select('id')
        .eq('email', trimmedEmail)
        .maybeSingle(),
      serviceSupabase
        .from('profiles')
        .select('id')
        .eq('email', trimmedEmail)
        .maybeSingle(),
    ]);

    if (accountRes.data || customerRes.data || profileRes.data) {
      return true;
    }
  } catch (checkErr) {
    console.warn('isEmailAlreadyTaken service check warning:', checkErr);
    try {
      const customerSupabase = await createCustomerClient();
      const { data: custData } = await customerSupabase
        .from('customers')
        .select('id')
        .eq('email', trimmedEmail)
        .maybeSingle();
      if (custData) return true;
    } catch {}
  }

  return false;
}

/**
 * Step 1: Validates signup details, username uniqueness, checks for duplicate email, and sends a 6-digit OTP.
 */
export async function initiateCustomerSignupFlow(params: {
  fullName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<InitiateSignupResult> {
  const fullName = params.fullName.trim();
  const username = (params.username || '').trim().toLowerCase();
  const email = params.email.trim().toLowerCase();
  const password = params.password.trim();
  const confirmPassword = params.confirmPassword.trim();

  if (!fullName) {
    return { error: 'Please enter your full name.' };
  }

  if (!username) {
    return { error: 'Please choose a username.' };
  }

  if (username.length < 3) {
    return { error: 'Username must be at least 3 characters.' };
  }

  if (username.length > 30) {
    return { error: 'Username must be at most 30 characters.' };
  }

  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    return { error: 'Username can only contain letters, numbers, dots, and underscores.' };
  }

  // Check username uniqueness
  const usernameTaken = await isUsernameAlreadyTaken(username);
  if (usernameTaken) {
    return { error: 'Username is already taken' };
  }

  if (!email || !email.includes('@')) {
    return { error: 'Please enter a valid email address.' };
  }

  const isAcceptedDomain = email.endsWith('@gmail.com') || email.endsWith('.in');
  if (!isAcceptedDomain) {
    return { error: 'Only @gmail.com and .in email addresses are accepted.' };
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

  // Duplicate email check
  const alreadyTaken = await isEmailAlreadyTaken(email);
  if (alreadyTaken) {
    return { error: 'Email is already taken' };
  }

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

  // Store in database with fallback
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

  // Encrypt the signup ticket (AES-256-GCM) with validated registration details including username
  const signupTicket = encryptTicket({
    fullName,
    username,
    email,
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
            <p style="font-size: 15px; color: #1e293b; margin: 0 0 16px; font-weight: 600;">Hi ${fullName},</p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px;">
              Thank you for creating your account with Travinco. Your chosen username is <strong>@${username}</strong>. Please enter the verification code below to verify your email and activate your account:
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

  const emailResult = await sendGmail({
    to: email,
    subject: `${otpCode} is your Travinco sign-up verification code`,
    html,
  });

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

    const { data: existingCust } = await serviceSupabase
      .from('customers')
      .select('id')
      .eq('email', trimmedEmail)
      .maybeSingle();

    if (!existingCust) {
      await serviceSupabase.from('customers').insert({
        full_name: payload.fullName,
        email: trimmedEmail,
        phone: '',
        source: 'website',
        is_active: true,
        is_deleted: false,
      } as any);
    }
  } catch (syncErr) {
    console.warn('Customer account sync notice:', syncErr);
  }

  // 5. Send rich "Account Created" welcome confirmation email to user's inbox
  try {
    const welcomeHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to Travinco</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 24px; margin: 0;">
          <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="background-color: #022c22; padding: 28px 24px; text-align: center;">
              <h1 style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 700; letter-spacing: 1px;">TRAVINCO</h1>
              <p style="color: #a7f3d0; font-size: 13px; margin: 6px 0 0; text-transform: uppercase; letter-spacing: 1.5px;">Welcome to Your Travel Portal</p>
            </div>
            <div style="padding: 32px 28px;">
              <p style="font-size: 15px; color: #1e293b; margin: 0 0 16px; font-weight: 600;">Welcome, ${payload.fullName}!</p>
              <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 16px;">
                Your Travinco customer account has been created successfully. Your username is <strong>@${payload.username}</strong>.
              </p>
              <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px;">
                You can now sign in at any time with either your <strong>email (${trimmedEmail})</strong> or your <strong>username (@${payload.username})</strong> to access your tailored holiday proposals, track your bookings, and view official invoices.
              </p>
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px 20px; margin: 0 0 24px;">
                <p style="font-size: 13px; color: #15803d; margin: 0; font-weight: 600;">
                  ✔ Direct Quotations &amp; Tailored Packages<br>
                  ✔ Trip Booking History &amp; Official Invoices<br>
                  ✔ 24/7 Dedicated Destination Specialists
                </p>
              </div>
              <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0;">
                If you have any questions or are ready to plan your next journey, our destination specialists are here to help.
              </p>
            </div>
            <div style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 16px 24px; text-align: center;">
              <p style="font-size: 11px; color: #94a3b8; margin: 0;">&copy; ${new Date().getFullYear()} Travinco Tours. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await sendGmail({
      to: trimmedEmail,
      subject: `Welcome to Travinco, ${payload.fullName}! Your account is ready`,
      html: welcomeHtml,
    });
  } catch (emailErr) {
    console.warn('Welcome email delivery notice:', emailErr);
  }

  return { success: true };
}
