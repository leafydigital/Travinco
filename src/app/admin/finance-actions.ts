'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile, assertRole } from '@/lib/supabase/auth-helpers';
import { incomeSchema, expenseSchema } from '@/lib/validations/finance';
import { revalidatePath } from 'next/cache';

const FINANCE_ROLES = ['accounts_staff', 'admin', 'super_admin'] as const;

export async function createIncome(raw: unknown) {
  const profile = await requireProfile();
  assertRole(profile, [...FINANCE_ROLES]);

  const parsed = incomeSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const supabase = await createClient();
  const { error } = await supabase.from('income').insert({
    ...parsed.data,
    customer_id: parsed.data.customer_id || null,
    booking_id: parsed.data.booking_id || null,
    created_by: profile.id,
  });

  if (error) return { error: 'Could not record income.' };

  revalidatePath('/admin/income');
  revalidatePath('/admin/reports');
  return {};
}

export async function deleteIncome(id: string) {
  const profile = await requireProfile();
  assertRole(profile, [...FINANCE_ROLES]);

  const supabase = await createClient();
  const { error } = await supabase.from('income').delete().eq('id', id);
  if (error) return { error: 'Could not delete income entry.' };

  revalidatePath('/admin/income');
  revalidatePath('/admin/reports');
  return {};
}

export async function createExpense(raw: unknown) {
  const profile = await requireProfile();
  assertRole(profile, [...FINANCE_ROLES]);

  const parsed = expenseSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const supabase = await createClient();
  const { error } = await supabase.from('expenses').insert({
    ...parsed.data,
    booking_id: parsed.data.booking_id || null,
    package_id: parsed.data.package_id || null,
    created_by: profile.id,
  });

  if (error) return { error: 'Could not record expense.' };

  revalidatePath('/admin/expenses');
  revalidatePath('/admin/reports');
  return {};
}

export async function deleteExpense(id: string) {
  const profile = await requireProfile();
  assertRole(profile, [...FINANCE_ROLES]);

  const supabase = await createClient();
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) return { error: 'Could not delete expense entry.' };

  revalidatePath('/admin/expenses');
  revalidatePath('/admin/reports');
  return {};
}

export async function createExpenseCategory(name: string) {
  const profile = await requireProfile();
  assertRole(profile, [...FINANCE_ROLES]);

  if (!name.trim()) return { error: 'Category name cannot be empty.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('expense_categories')
    .insert({ name: name.trim() })
    .select('id, name')
    .single();

  if (error) {
    if (error.code === '23505') return { error: 'A category with this name already exists.' };
    return { error: 'Could not create category.' };
  }

  revalidatePath('/admin/expenses');
  revalidatePath('/admin/settings');
  return { category: data };
}
