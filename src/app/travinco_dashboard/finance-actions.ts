'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile, assertRole } from '@/lib/supabase/auth-helpers';
import { incomeSchema, expenseSchema } from '@/lib/validations/finance';
import { revalidatePath } from 'next/cache';
import { encodePaymentMethod } from '@/lib/payment-methods';

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

  revalidatePath('/travinco_dashboard/income');
  return {};
}

export async function deleteIncome(id: string) {
  const profile = await requireProfile();
  if (profile.role !== 'admin' && profile.role !== 'super_admin') {
    return { error: 'Only administrators can delete income records.' };
  }

  const supabase = await createClient();
  let { error } = await supabase.from('income').update({ is_deleted: true } as any).eq('id', id);
  if (error && error.message?.includes('is_deleted')) {
    const fallback = await supabase.from('income').delete().eq('id', id);
    if (fallback.error) return { error: fallback.error.message };
  } else if (error) {
    return { error: 'Could not delete income entry.' };
  }

  revalidatePath('/travinco_dashboard/income');
  return {};
}

async function resolveCategoryId(supabase: any, rawCategory: string): Promise<string> {
  const trimmed = rawCategory.trim();
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

  if (uuidRegex.test(trimmed)) {
    const { data: existing } = await supabase
      .from('expense_categories')
      .select('id')
      .eq('id', trimmed)
      .maybeSingle();
    if (existing?.id) return existing.id;
  }

  // Look up existing category by name (case-insensitive)
  const { data: byName } = await supabase
    .from('expense_categories')
    .select('id')
    .ilike('name', trimmed)
    .maybeSingle();

  if (byName?.id) return byName.id;

  // Insert new category
  const { data: created, error } = await supabase
    .from('expense_categories')
    .insert({ name: trimmed, is_active: true })
    .select('id')
    .single();

  if (created?.id) return created.id;

  // In case of duplicate/conflict, retry fetch
  if (error) {
    const { data: retry } = await supabase
      .from('expense_categories')
      .select('id')
      .ilike('name', trimmed)
      .maybeSingle();
    if (retry?.id) return retry.id;
  }

  throw new Error('Could not resolve or create expense category.');
}

export async function createExpense(raw: unknown) {
  const profile = await requireProfile();
  assertRole(profile, [...FINANCE_ROLES]);

  const parsed = expenseSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const supabase = await createClient();
  let categoryId: string;
  try {
    categoryId = await resolveCategoryId(supabase, parsed.data.category_id);
  } catch (err: any) {
    console.error('resolveCategoryId error:', err);
    return { error: 'Could not resolve expense category.' };
  }

  const { error } = await supabase.from('expenses').insert({
    ...parsed.data,
    ...encodePaymentMethod(parsed.data.payment_method, parsed.data.notes),
    category_id: categoryId,
    booking_id: parsed.data.booking_id || null,
    package_id: parsed.data.package_id || null,
    created_by: profile.id,
  });

  if (error) {
    console.error('createExpense error:', error);
    return { error: 'Could not record expense.' };
  }

  revalidatePath('/travinco_dashboard/expenses');
  return {};
}

export async function updateExpense(id: string, raw: unknown) {
  const profile = await requireProfile();
  assertRole(profile, [...FINANCE_ROLES]);

  const parsed = expenseSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const supabase = await createClient();
  let categoryId: string;
  try {
    categoryId = await resolveCategoryId(supabase, parsed.data.category_id);
  } catch (err: any) {
    console.error('resolveCategoryId update error:', err);
    return { error: 'Could not resolve expense category.' };
  }

  // The edit form doesn't send notes — keep the stored ones (minus any old payment label).
  let existingNotes = parsed.data.notes;
  if (existingNotes === undefined) {
    const { data: current } = await supabase.from('expenses').select('notes').eq('id', id).maybeSingle();
    existingNotes = current?.notes ?? null;
  }
  const payment = encodePaymentMethod(parsed.data.payment_method, existingNotes);

  const { error } = await supabase
    .from('expenses')
    .update({
      expense_date: parsed.data.expense_date,
      category_id: categoryId,
      supplier: parsed.data.supplier || null,
      description: parsed.data.description || null,
      booking_id: parsed.data.booking_id || null,
      package_id: parsed.data.package_id || null,
      amount: parsed.data.amount,
      payment_method: payment.payment_method,
      reference_number: parsed.data.reference_number || null,
      notes: payment.notes,
    })
    .eq('id', id);

  if (error) {
    console.error('updateExpense error:', error);
    return { error: 'Could not update expense.' };
  }

  revalidatePath('/travinco_dashboard/expenses');
  revalidatePath('/travinco_dashboard');
  return {};
}

export async function deleteExpense(id: string) {
  const profile = await requireProfile();
  if (profile.role !== 'admin' && profile.role !== 'super_admin') {
    return { error: 'Only administrators can delete expense records.' };
  }

  const supabase = await createClient();

  // 1. Try RPC soft_delete_expense
  const { error: rpcError } = await supabase.rpc('soft_delete_expense', {
    expense_id: id,
  });

  // 2. Direct update fallback
  if (rpcError) {
    let { error } = await supabase
      .from('expenses')
      .update({ is_deleted: true } as any)
      .eq('id', id);

    if (error && error.message?.includes('is_deleted')) {
      console.warn('Column is_deleted missing from expenses table. Soft-deleting via website_settings marker.');
    } else if (error) {
      return { error: 'Could not delete expense entry.' };
    }
  }

  // 3. Guaranteed fallback tracking in website_settings so expense is soft-deleted even without column
  try {
    await supabase.from('website_settings').upsert({
      key: `deleted_expense_${id}`,
      value: { is_deleted: true, deleted_at: new Date().toISOString() },
    }, { onConflict: 'key' });
  } catch (err) {
    console.warn('Failed to record deleted_expense marker:', err);
  }

  revalidatePath('/travinco_dashboard/expenses');
  revalidatePath('/travinco_dashboard');
  return {};
}
