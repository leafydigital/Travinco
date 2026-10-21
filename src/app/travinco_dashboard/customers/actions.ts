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

  // 1. Try RPC toggle_customer_status
  const { error: rpcError } = await supabase.rpc('toggle_customer_status', {
    cust_id: id,
    set_active: active,
  });

  // 2. Direct update fallback
  if (rpcError) {
    let { error } = await supabase.from('customers').update({ is_active: active } as any).eq('id', id);
    if (error && error.message?.includes('is_active')) {
      console.warn('Column is_active missing from customers table. Using website_settings marker.');
    } else if (error) {
      return { error: 'Could not change customer status: ' + error.message };
    }
  }

  // 3. Fallback tracking in website_settings
  try {
    await supabase.from('website_settings').upsert({
      key: `customer_status_${id}`,
      value: { is_active: active, updated_at: new Date().toISOString() },
    });
  } catch (err) {
    console.warn('Failed to record customer_status marker:', err);
  }

  revalidatePath('/travinco_dashboard/customers');
  revalidatePath('/admin/customers');
  revalidatePath(`/admin/customers/${id}`);
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
    });
  } catch (err) {
    console.warn('Failed to record deleted_customer marker:', err);
  }

  revalidatePath('/travinco_dashboard/customers');
  revalidatePath('/admin/customers');
  revalidatePath(`/admin/customers/${id}`);
  return {};
}
