import nodemailer from 'nodemailer';

/**
 * Sends email via Gmail's own SMTP server, using an App Password (not
 * your normal Gmail login password — see Google Account -> Security ->
 * App passwords, which requires 2-Step Verification to be turned on
 * first). Free, but capped around 500 emails/day and meant for
 * low-volume sending — fine for OTP verification links, not a
 * marketing-blast solution.
 *
 * Requires GMAIL_USER (the full address) and GMAIL_APP_PASSWORD (the
 * 16-character App Password) as environment variables.
 *
 * Note: raw SMTP on port 587 is frequently blocked or unreliable on
 * serverless hosting (Netlify, Vercel). If sendMail keeps failing even
 * with confirmed-correct credentials, that's the most likely cause —
 * see the error logged below for the actual underlying reason.
 */
export function isGmailConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

export async function sendGmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ error?: string }> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return { error: 'not_configured' };
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 10000,
  });

  try {
    await transporter.sendMail({
      from: user,
      to,
      subject,
      html,
    });
    return {};
  } catch (err) {
    // Logged server-side (visible in Netlify's function logs) so the
    // actual SMTP failure reason is diagnosable — the generic message
    // returned to the browser stays vague on purpose, but this at
    // least gives something concrete to act on.
    const message = err instanceof Error ? err.message : String(err);
    console.error('sendGmail failed:', message);
    return { error: `send_failed: ${message}` };
  }
}
