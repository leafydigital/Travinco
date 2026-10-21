import 'server-only';
import { createClient } from '@/lib/supabase/server';

export const DEFAULT_ADMIN_NOTIFICATION_EMAIL = 'travinco2026@gmail.com';

/**
 * Retrieves the admin notification email from website_settings.
 * Defaults to 'travinco2026@gmail.com'.
 */
export async function getAdminNotificationEmail(): Promise<string> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('website_settings')
      .select('value')
      .eq('key', 'admin_notification_email')
      .maybeSingle();

    if (data?.value) {
      if (typeof data.value === 'string' && data.value.trim()) {
        return data.value.trim();
      }
      if (typeof data.value === 'object' && (data.value as any)?.email) {
        const val = String((data.value as any).email).trim();
        if (val) return val;
      }
    }
  } catch (err) {
    console.warn('Could not read admin_notification_email from website_settings, using fallback:', err);
  }

  return process.env.NOTIFICATION_EMAIL_TO || DEFAULT_ADMIN_NOTIFICATION_EMAIL;
}

/**
 * Disabled: Customer contact requests are saved directly to the database
 * and displayed in Admin -> Enquiries without sending emails.
 */
export async function notifyAdminOfContactMessage(_params: {
  name: string;
  email?: string | null;
  phone?: string | null;
  whatsapp_number?: string | null;
  subject?: string | null;
  message?: string | null;
}) {
  // Email sending removed per user requirement
  return;
}

/**
 * Disabled: Customer booking / "Book with us" enquiries are saved directly
 * to the database and displayed in Admin -> Enquiries without sending emails.
 */
export async function notifyAdminOfEnquiry(_params: {
  enquiryNumber?: string;
  customerName: string;
  phone: string;
  email?: string | null;
  whatsapp_number?: string | null;
  destination?: string | null;
  travel_date?: string | null;
  adults?: number;
  children?: number;
  infants?: number;
  budget?: string | null;
  message?: string | null;
}) {
  // Email sending removed per user requirement
  return;
}
