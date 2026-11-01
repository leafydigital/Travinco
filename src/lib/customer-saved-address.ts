import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { escapeLike } from '@/lib/auth/signup-rules';

type AddressRow = { address?: string | null; is_deleted?: boolean };

/**
 * Address the customer saved on their website profile (/account/profile), so staff
 * see it on the enquiry and it prefills the invoice "Bill to" address.
 * Profile saves write to customer_accounts and are synced to a customers row, so the
 * account (matched by email) is checked first, then the linked customer, then any
 * customer row with the same email. Returns '' when nothing is saved.
 *
 * Uses the service client (customer_accounts is not readable by staff under RLS):
 * callers must already have checked the viewer may see this enquiry / invoice.
 */
export async function getCustomerSavedAddress({
  customerId,
  email,
}: {
  customerId?: string | null;
  email?: string | null;
}): Promise<string> {
  const service = createServiceClient();
  const mail = email?.trim();

  try {
    if (mail) {
      // customer_accounts.address comes from the profile migration; ignore the error if it hasn't run
      const { data, error } = await service
        .from('customer_accounts')
        .select('address')
        .ilike('email', escapeLike(mail))
        .limit(1);
      const address = error ? '' : (data?.[0] as AddressRow | undefined)?.address?.trim();
      if (address) return address;
    }

    if (customerId) {
      const { data } = await service.from('customers').select('address, is_deleted').eq('id', customerId).maybeSingle();
      const row = data as AddressRow | null;
      const address = row && row.is_deleted !== true ? row.address?.trim() : '';
      if (address) return address;
    }

    if (mail) {
      const { data } = await service
        .from('customers')
        .select('address, is_deleted')
        .ilike('email', escapeLike(mail))
        .order('created_at', { ascending: true })
        .limit(20);
      const row = ((data ?? []) as AddressRow[]).find((r) => r.is_deleted !== true && r.address?.trim());
      if (row?.address) return row.address.trim();
    }
  } catch (err) {
    console.warn('getCustomerSavedAddress:', err instanceof Error ? err.message : err);
  }
  return '';
}
