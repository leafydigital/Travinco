'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile, checkModulePermission } from '@/lib/supabase/auth-helpers';
import { createServiceClient } from '@/lib/supabase/service';
import { customerSchema, newCustomerSchema } from '@/lib/validations/customer';
import { escapeLike } from '@/lib/auth/signup-rules';
import { isUsernameAlreadyTaken, phoneVariants } from '@/lib/auth/signup-otp';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { isValidPhoneNumber } from 'libphonenumber-js/mobile';
import { validateFullName, validateEmailAddress } from '@/lib/validations/contact-rules';
import { isFakePhone } from '@/lib/validations/phone';

/** The field a friendly error belongs to, so the form can show it under that input. */
type CustomerField = 'full_name' | 'phone' | 'whatsapp_number' | 'email' | 'password';
type CustomerActionError = { error: string; field?: CustomerField };

function firstIssue(error: z.ZodError): CustomerActionError {
  const issue = error.issues[0];
  return {
    error: issue?.message ?? 'Please check the form.',
    field: (issue?.path[0] as CustomerField | undefined) ?? undefined,
  };
}

/**
 * Returns a friendly message when another (not deleted) customer already has this
 * email or phone number, or (for new logins) the email already belongs to an account.
 */
async function findCustomerConflict(
  { email, phone, excludeId }: { email?: string | null; phone?: string | null; excludeId?: string },
  checkAccounts = false
): Promise<CustomerActionError | null> {
  const service = createServiceClient();
  const others = (rows: unknown) =>
    ((rows as { id: string; is_deleted?: boolean | null }[] | null) ?? []).filter(
      (r) => r.id !== excludeId && r.is_deleted !== true
    );

  if (email) {
    const { data } = await service.from('customers').select('id, is_deleted').ilike('email', escapeLike(email)).limit(5);
    if (others(data).length) {
      return { field: 'email', error: 'A customer with this email address already exists.' };
    }
    if (checkAccounts) {
      const [accountRes, staffRes] = await Promise.all([
        service.from('customer_accounts').select('id').ilike('email', escapeLike(email)).limit(1),
        service.from('profiles').select('id').ilike('email', escapeLike(email)).limit(1),
      ]);
      if (accountRes.data?.length) {
        return { field: 'email', error: 'This email address is already registered on the website.' };
      }
      if (staffRes.data?.length) {
        return { field: 'email', error: 'This email address belongs to a team member. Please use another email.' };
      }
    }
  }

  if (phone) {
    const { data } = await service.from('customers').select('id, is_deleted').in('phone', phoneVariants(phone)).limit(5);
    if (others(data).length) {
      return { field: 'phone', error: 'A customer with this phone number already exists.' };
    }
  }
  return null;
}

/** A unique website username from the email prefix (rahul, rahul2, rahul3 …). */
async function uniqueCustomerUsername(email: string): Promise<string> {
  const base = (email.split('@')[0] || 'customer').replace(/\s+/g, '').slice(0, 24) || 'customer';
  for (let i = 1; i < 50; i++) {
    const candidate = i === 1 ? base : `${base}${i}`;
    if (!(await isUsernameAlreadyTaken(candidate))) return candidate;
  }
  return `${base}${Date.now().toString().slice(-6)}`;
}

/**
 * Creates a customer from the dashboard, together with their website login
 * (email + the password entered by the team).
 */
export async function createCustomer(raw: unknown): Promise<CustomerActionError | { id: string; error?: undefined }> {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'customers', 'edit');
  if (!perm.allowed) return { error: perm.error || 'You do not have permission to create customers.' };

  const parsed = newCustomerSchema.safeParse(raw);
  if (!parsed.success) return firstIssue(parsed.error);

  const { password, ...customer } = parsed.data;
  const email = customer.email.toLowerCase();
  const fullName = customer.full_name.replace(/\s+/g, ' ');

  const conflict = await findCustomerConflict({ email, phone: customer.phone }, true);
  if (conflict) return conflict;

  // 1. Website login
  const service = createServiceClient();
  const username = await uniqueCustomerUsername(email);
  const { data: authData, error: authError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      username,
      phone: customer.phone,
      role: 'customer',
      is_customer_signup: 'true',
    },
  });
  if (authError || !authData?.user) {
    if (authError?.message?.toLowerCase().includes('already')) {
      return { field: 'email', error: 'This email address is already registered on the website.' };
    }
    console.error('createCustomer auth error:', authError);
    return { error: 'Could not create the customer login. Please try again.' };
  }
  const userId = authData.user.id;

  await service.from('customer_accounts').upsert(
    {
      id: userId,
      full_name: fullName,
      username,
      email,
      phone: customer.phone,
      address: customer.address || null,
    } as any,
    { onConflict: 'id' }
  );

  // 2. Customer record
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customers')
    .insert({
      ...customer,
      full_name: fullName,
      email,
      whatsapp_number: customer.whatsapp_number || customer.phone,
      created_by: profile.id,
    })
    .select('id')
    .single();

  if (error) {
    // Don't leave a login behind without its customer record
    await service.from('customer_accounts').delete().eq('id', userId);
    await service.auth.admin.deleteUser(userId);
    console.error('createCustomer insert error:', error);
    return { error: 'Could not create the customer. Please try again.' };
  }

  revalidatePath('/travinco_dashboard/customers');
  return { id: data.id };
}

export async function updateCustomer(id: string, raw: unknown): Promise<CustomerActionError | { error?: undefined }> {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'customers', 'edit');
  if (!perm.allowed) return { error: perm.error || 'You do not have permission to edit customers.' };

  const parsed = customerSchema.safeParse(raw);
  if (!parsed.success) return firstIssue(parsed.error);

  const conflict = await findCustomerConflict({ email: parsed.data.email, phone: parsed.data.phone, excludeId: id });
  if (conflict) return conflict;

  const supabase = await createClient();
  const { error } = await supabase
    .from('customers')
    .update({ ...parsed.data, email: parsed.data.email || null })
    .eq('id', id);

  if (error) return { error: 'Could not update the customer. Please try again.' };

  revalidatePath('/travinco_dashboard/customers');
  revalidatePath('/travinco_dashboard/customers');
  revalidatePath(`/travinco_dashboard/customers/${id}`);
  return {};
}

export async function toggleCustomerStatus(id: string, active: boolean) {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'customers', 'edit');
  if (!perm.allowed) return { error: perm.error || 'You do not have permission to edit customers.' };

  const supabase = await createClient();

  // Column update and website_settings marker (fallback for DBs without is_active) run in parallel.
  const [{ error }] = await Promise.all([
    supabase.from('customers').update({ is_active: active } as any).eq('id', id),
    supabase
      .from('website_settings')
      .upsert({
        key: `customer_status_${id}`,
        value: { is_active: active, updated_at: new Date().toISOString() },
      }, { onConflict: 'key' })
      .then(({ error: markerError }) => {
        if (markerError) console.warn('Failed to record customer_status marker:', markerError);
      }),
  ]);
  if (error && !error.message?.includes('is_active')) {
    return { error: 'Could not change customer status: ' + error.message };
  }

  revalidatePath('/travinco_dashboard/customers');
  return { success: true };
}

export async function deleteCustomer(id: string) {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'customers', 'edit');
  if (!perm.allowed || !['admin', 'super_admin'].includes(profile.role)) {
    return { error: perm.error || 'Only admins can delete customers.' };
  }

  const supabase = await createClient();

  // 1. Try RPC soft_delete_customer
  const { error: rpcError } = await supabase.rpc('soft_delete_customer', {
    cust_id: id,
  });

  // 2. Direct update fallback
  if (rpcError) {
    let { error } = await supabase.from('customers').update({ is_deleted: true } as any).eq('id', id);
    if (error && error.message?.includes('is_deleted')) {
      console.warn('Column is_deleted missing from customers table. Using website_settings marker.');
    } else if (error) {
      return { error: 'Could not delete customer: ' + error.message };
    }
  }

  // 3. Fallback tracking in website_settings so it is always filtered out
  try {
    await supabase.from('website_settings').upsert({
      key: `deleted_customer_${id}`,
      value: { is_deleted: true, deleted_at: new Date().toISOString() },
    }, { onConflict: 'key' });
  } catch (err) {
    console.warn('Failed to record deleted_customer marker:', err);
  }

  revalidatePath('/travinco_dashboard/customers');
  revalidatePath('/travinco_dashboard/customers');
  revalidatePath(`/travinco_dashboard/customers/${id}`);
  return {};
}

export interface CustomerTableItem {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  source: string | null;
  is_active: boolean;
  /** Soft-deleted: still listed in the table with a "Deleted" status, but read-only. */
  is_deleted: boolean;
}

export interface CustomersTableQueryResult {
  customers: CustomerTableItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

export interface FullCustomerDetail {
  id: string;
  full_name: string;
  phone: string | null;
  whatsapp_number: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  source: string | null;
  notes: string | null;
  is_active: boolean;
}

/**
 * Fast, lean query fetching strictly the 6 table columns:
 * Customer (id, full_name), Phone, Email, City, Source, Status (is_active / is_deleted).
 * Excludes heavy notes, whatsapp_number, state, country, etc.
 */
export async function getCustomersTableList({
  page = 1,
  pageSize = 20,
  q = '',
  status = '',
}: {
  page?: number;
  pageSize?: number;
  q?: string;
  /** '' (all) | 'active' | 'deactivated' | 'deleted' */
  status?: string;
} = {}): Promise<CustomersTableQueryResult> {
  const profile = await requireProfile();
  await checkModulePermission(profile, 'customers', 'view');

  const supabase = await createClient();

  const currentPage = Math.max(1, page);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('customers')
    .select(
      'id, full_name, phone, email, city, source, is_active, is_deleted, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false });

  if (q && q.trim()) {
    const term = q.trim();
    query = query.or(
      `full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`
    );
  }

  if (status === 'deleted') {
    query = query.eq('is_deleted', true);
  } else if (status === 'active' || status === 'deactivated') {
    query = query.or('is_deleted.is.null,is_deleted.eq.false').eq('is_active', status === 'active');
  }

  const [{ data: customers, count, error }, { data: settingsData }] = await Promise.all([
    query.range(from, to),
    supabase
      .from('website_settings')
      .select('key, value')
      .or('key.like.deleted_customer_%,key.like.customer_status_%'),
  ]);

  let customerRows: any[] = customers || [];
  if (error && (error.message?.includes('is_deleted') || error.message?.includes('is_active'))) {
    let fallbackQuery = supabase
      .from('customers')
      .select('id, full_name, phone, email, city, source, created_at', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (q && q.trim()) {
      const term = q.trim();
      fallbackQuery = fallbackQuery.or(
        `full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`
      );
    }
    const fallbackRes = await fallbackQuery.range(from, to);
    customerRows = fallbackRes.data || [];
  }

  const deletedKeys = new Set(
    (settingsData || [])
      .filter((s: any) => s.key?.startsWith('deleted_customer_'))
      .map((s: any) => s.key.replace('deleted_customer_', ''))
  );

  const statusOverrides = new Map<string, boolean>();
  (settingsData || [])
    .filter((s: any) => s.key?.startsWith('customer_status_'))
    .forEach((s: any) => {
      const id = s.key.replace('customer_status_', '');
      if (s.value && typeof s.value.is_active === 'boolean') {
        statusOverrides.set(id, s.value.is_active);
      }
    });

  // Deleted customers stay in the list (shown with a "Deleted" status)
  const items: CustomerTableItem[] = customerRows.filter(Boolean).map((c: any) => {
    // The is_active column is authoritative; the website_settings marker is only a
    // fallback for databases without that column.
    const isActive =
      typeof c.is_active === 'boolean'
        ? c.is_active
        : statusOverrides.has(c.id)
          ? statusOverrides.get(c.id)!
          : c.is_active !== 'false' && (c as any).status !== 'inactive';

    return {
      id: c.id,
      full_name: c.full_name,
      phone: c.phone || null,
      email: c.email || null,
      city: c.city || null,
      source: c.source || null,
      is_active: isActive,
      is_deleted:
        c.is_deleted === true || c.is_deleted === 'true' || c.is_deleted === 1 || deletedKeys.has(c.id),
    };
  });

  const totalCount = count ?? items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    customers: items,
    totalCount,
    totalPages,
    page: currentPage,
    pageSize,
  };
}

/**
 * On-demand query to fetch the full customer detail strictly when editing
 */
export async function getCustomerById(id: string): Promise<{ data?: FullCustomerDetail; error?: string }> {
  const profile = await requireProfile();
  await checkModulePermission(profile, 'customers', 'view');

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('customers')
    .select('id, full_name, phone, whatsapp_number, email, address, city, state, country, source, notes, is_active')
    .eq('id', id)
    .single();

  if (error || !data) {
    return { error: error?.message || 'Customer not found' };
  }

  // Check status override if any
  const { data: statusSetting } = await supabase
    .from('website_settings')
    .select('value')
    .eq('key', `customer_status_${id}`)
    .maybeSingle();

  let isActive = data.is_active !== false && data.is_active !== 'false';
  if (
    typeof data.is_active !== 'boolean' &&
    statusSetting?.value &&
    typeof statusSetting.value.is_active === 'boolean'
  ) {
    isActive = statusSetting.value.is_active;
  }

  return {
    data: {
      id: data.id,
      full_name: data.full_name,
      phone: data.phone || null,
      whatsapp_number: data.whatsapp_number || null,
      email: data.email || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      country: data.country || null,
      source: data.source || 'website',
      notes: data.notes || null,
      is_active: isActive,
    },
  };
}


const phoneValue = z
  .string()
  .trim()
  .refine((v) => isValidPhoneNumber(v) && !isFakePhone(v), { message: 'Enter a valid phone number' });

/** Fields edited in the quick "Edit Customer" modal — nothing else on the record is touched. */
const customerQuickEditSchema = z.object({
  full_name: z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      const err = validateFullName(v);
      if (err) ctx.addIssue({ code: 'custom', message: err });
    }),
  phone: phoneValue,
  whatsapp_number: phoneValue.nullable().optional(),
  email: z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      if (!v) return;
      const err = validateEmailAddress(v);
      if (err) ctx.addIssue({ code: 'custom', message: err });
    })
    .nullable()
    .optional(),
  address: z.string().trim().max(500, 'Address is too long').nullable().optional(),
  source: z.enum(['website', 'whatsapp', 'phone', 'walk_in', 'referral', 'social_media', 'other']),
  notes: z.string().max(2000).nullable().optional(),
});

export async function updateCustomerDetails(
  id: string,
  raw: unknown
): Promise<CustomerActionError | { error?: undefined }> {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'customers', 'edit');
  if (!perm.allowed) return { error: perm.error || 'You do not have permission to edit customers.' };

  const parsed = customerQuickEditSchema.safeParse(raw);
  if (!parsed.success) return firstIssue(parsed.error);

  const d = parsed.data;
  const conflict = await findCustomerConflict({ email: d.email, phone: d.phone, excludeId: id });
  if (conflict) return conflict;

  const supabase = await createClient();
  const { error } = await supabase
    .from('customers')
    .update({
      full_name: d.full_name.replace(/\s+/g, ' '),
      phone: d.phone,
      whatsapp_number: d.whatsapp_number || null,
      email: d.email || null,
      address: d.address || null,
      source: d.source,
      notes: d.notes || null,
    })
    .eq('id', id);

  if (error) return { error: 'Could not update the customer. Please try again.' };

  revalidatePath('/travinco_dashboard/customers');
  revalidatePath(`/travinco_dashboard/customers/${id}`);
  return {};
}

/** Restores a soft-deleted customer (admins only). */
export async function restoreCustomer(id: string): Promise<{ error?: string }> {
  const profile = await requireProfile();
  if (!['admin', 'super_admin'].includes(profile.role)) {
    return { error: 'Only admins can restore customers.' };
  }

  const supabase = await createClient();
  const { data: customer } = await supabase.from('customers').select('id, email, phone').eq('id', id).maybeSingle();
  if (!customer) return { error: 'Customer not found.' };

  // Another active customer may have taken the email / phone in the meantime
  const conflict = await findCustomerConflict({ email: customer.email, phone: customer.phone, excludeId: id });
  if (conflict) return { error: `Cannot restore: ${conflict.error.charAt(0).toLowerCase()}${conflict.error.slice(1)}` };

  const { error } = await supabase.from('customers').update({ is_deleted: false } as any).eq('id', id);
  if (error && !error.message?.includes('is_deleted')) return { error: 'Could not restore the customer. Please try again.' };
  await supabase.from('website_settings').delete().eq('key', `deleted_customer_${id}`);

  revalidatePath('/travinco_dashboard/customers');
  revalidatePath(`/travinco_dashboard/customers/${id}`);
  return {};
}

/**
 * Live "already taken" check for the customer forms (run as the team types / leaves a field).
 * `newLogin` also checks website and team accounts, as a new customer gets a website login.
 */
export async function checkCustomerAvailability(input: {
  email?: string;
  phone?: string;
  excludeId?: string;
  newLogin?: boolean;
}): Promise<{ email: string | null; phone: string | null }> {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'customers', 'view');
  if (!perm.allowed) return { email: null, phone: null };

  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone?.trim() || null;
  const [emailConflict, phoneConflict] = await Promise.all([
    email ? findCustomerConflict({ email, excludeId: input.excludeId }, Boolean(input.newLogin)) : null,
    phone ? findCustomerConflict({ phone, excludeId: input.excludeId }) : null,
  ]);
  return { email: emailConflict?.error ?? null, phone: phoneConflict?.error ?? null };
}
