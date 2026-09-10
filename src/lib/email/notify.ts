import 'server-only';

const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * Sends an admin notification email via Resend. If RESEND_API_KEY isn't
 * set, this is a no-op — email is an additive notification on top of the
 * database record, never the source of truth, so a missing key must never
 * block or fail the calling flow (enquiry/contact submission).
 */
export async function notifyAdminOfEnquiry(params: {
  enquiryNumber: string;
  customerName: string;
  phone: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFICATION_EMAIL_TO;
  const from = process.env.NOTIFICATION_EMAIL_FROM;

  if (!apiKey || !to || !from) return;

  await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject: `New enquiry ${params.enquiryNumber} — ${params.customerName}`,
      html: `<p>New website enquiry received.</p>
             <p><strong>Enquiry #:</strong> ${params.enquiryNumber}<br/>
             <strong>Name:</strong> ${params.customerName}<br/>
             <strong>Phone:</strong> ${params.phone}</p>
             <p>View it in the admin CRM to respond.</p>`,
    }),
  });
}

export async function notifyAdminOfContactMessage(params: {
  name: string;
  subject: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFICATION_EMAIL_TO;
  const from = process.env.NOTIFICATION_EMAIL_FROM;

  if (!apiKey || !to || !from) return;

  await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject: `New contact message — ${params.name}`,
      html: `<p>New contact form submission from <strong>${params.name}</strong>.</p>
             ${params.subject ? `<p>Subject: ${params.subject}</p>` : ''}
             <p>View it in the admin panel to respond.</p>`,
    }),
  });
}
