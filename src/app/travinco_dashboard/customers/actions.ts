'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile, checkModulePermission } from '@/lib/supabase/auth-helpers';
import { customerSchema } from '@/lib/validations/customer';
import { revalidatePath } from 'next/cache';

export async function createCustomer(raw: unknown) {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'customers', 'edit');
  if (!perm.allowed) return { error: perm.error || 'You do not have permission to create customers.' };

  const parsed = customerSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customers')
    .insert({ ...parsed.data, email: parsed.data.email || null, created_by: profile.id })
    .select('id')
    .single();

  if (error) return { error: 'Could not create customer.' };

  revalidatePath('/travinco_dashboard/customers');
  return { id: data.id };
}

export async function updateCustomer(id: string, raw: unknown) {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'customers', 'edit');
  if (!perm.allowed) return { error: perm.error || 'You do not have permission to edit customers.' };

  const parsed = customerSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('customers')
    .update({ ...parsed.data, email: parsed.data.email || null })
    .eq('id', id);

  if (error) return { error: 'Could not update customer.' };

  revalidatePath('/travinco_dashboard/customers');
  revalidatePath('/admin/customers');
  revalidatePath(`/admin/customers/${id}`);
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
  revalidatePath('/admin/customers');
  revalidatePath(`/admin/customers/${id}`);
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
  city: string | null;
  state: string | null;
  country: string | null;
  source: string | null;
  notes: string | null;
  is_active: boolean;
}

/**
 * Fast, lean query fetching strictly the 6 table columns:
 * Customer (id, full_name), Phone, Email, City, Source, Status (is_active).
 * Excludes heavy notes, whatsapp_number, state, country, etc.
 */
export async function getCustomersTableList({
  page = 1,
  pageSize = 20,
  q = '',
}: {
  page?: number;
  pageSize?: number;
  q?: string;
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

  const visibleCustomers = customerRows.filter(
    (c: any) =>
      c &&
      c.is_deleted !== true &&
      c.is_deleted !== 'true' &&
      c.is_deleted !== 1 &&
      !deletedKeys.has(c.id)
  );

  const items: CustomerTableItem[] = visibleCustomers.map((c: any) => {
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
    .select('id, full_name, phone, whatsapp_number, email, city, state, country, source, notes, is_active')
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
      city: data.city || null,
      state: data.state || null,
      country: data.country || null,
      source: data.source || 'website',
      notes: data.notes || null,
      is_active: isActive,
    },
  };
}

