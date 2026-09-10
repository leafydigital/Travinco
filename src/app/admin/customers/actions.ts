'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { customerSchema } from '@/lib/validations/customer';
import { revalidatePath } from 'next/cache';

export async function createCustomer(raw: unknown) {
  const profile = await requireProfile();
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

  revalidatePath('/admin/customers');
  return { id: data.id };
}

export async function updateCustomer(id: string, raw: unknown) {
  await requireProfile();
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

  revalidatePath('/admin/customers');
  revalidatePath(`/admin/customers/${id}`);
  return {};
}

export async function deleteCustomer(id: string) {
  const profile = await requireProfile();
  if (!['admin', 'super_admin'].includes(profile.role)) {
    return { error: 'Only admins can delete customers.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) {
    return {
      error:
        'Could not delete customer. They may have existing enquiries or bookings — those must be removed first.',
    };
  }

  revalidatePath('/admin/customers');
  return {};
}
