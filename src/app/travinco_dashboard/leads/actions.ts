'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile, checkModulePermission } from '@/lib/supabase/auth-helpers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const LEADS_PATH = '/travinco_dashboard/leads';

export type LeadStatus = 'fresh_lead' | 'follow_up' | 'interested' | 'not_interested' | 'enquired' | 'converted';

async function checkLeadPermission(action: 'view' | 'edit' = 'edit') {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'leads' as any, action);
  if (!perm.allowed && !['super_admin', 'admin', 'sales_staff', 'accounts_staff'].includes(profile.role)) {
    return { error: 'You do not have permission to manage leads.' };
  }
  return { profile };
}

export async function updateLeadStatus(
  leadId: string,
  status: LeadStatus
): Promise<{ error?: string }> {
  const check = await checkLeadPermission('edit');
  if (check.error) return { error: check.error };
  const supabase = await createClient();
  const { error } = await supabase.from('leads').update({ status }).eq('id', leadId);
  if (error) return { error: 'Could not update lead status.' };
  revalidatePath(LEADS_PATH);
  return {};
}

const leadRowSchema = z.object({
  contact_name: z.string().min(1, 'Contact name is required').max(120),
  contact_number: z.string().min(4, 'Contact number is required').max(30),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  package: z.string().max(200).optional().or(z.literal('')),
  number_of_days: z.coerce.number().int().min(0).optional().nullable(),
  budget: z.coerce.number().min(0).optional().nullable(),
  from_date: z.string().optional().nullable(),
  to_date: z.string().optional().nullable(),
  number_of_people: z.coerce.number().int().min(0).optional().nullable(),
});

export type LeadImportRow = z.infer<typeof leadRowSchema>;

export async function importLeads(rows: LeadImportRow[]): Promise<{
  imported?: number;
  duplicates?: number;
  errors?: string[];
  error?: string;
}> {
  const check = await checkLeadPermission('edit');
  if (check.error) return { error: check.error };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const batchId = crypto.randomUUID();
  const errors: string[] = [];
  const validRows: any[] = [];

  for (let i = 0; i < rows.length; i++) {
    const parsed = leadRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      errors.push(`Row ${i + 1}: ${parsed.error.issues[0]?.message ?? 'Invalid data'}`);
      continue;
    }
    const d = parsed.data;
    validRows.push({
      contact_name: d.contact_name,
      contact_number: d.contact_number,
      email: d.email || null,
      package: d.package || null,
      number_of_days: d.number_of_days ?? null,
      budget: d.budget ?? null,
      from_date: d.from_date || null,
      to_date: d.to_date || null,
      number_of_people: d.number_of_people ?? null,
      status: 'fresh_lead', // Default extracted/imported status is 'fresh_lead'
      source: 'excel_import',
      import_batch: batchId,
      is_deleted: false,
      created_by: user?.id ?? null,
    });
  }

  if (validRows.length === 0) {
    return { imported: 0, duplicates: 0, errors };
  }

  // Check duplicates against non-deleted leads
  const { data: existing } = await supabase
    .from('leads')
    .select('contact_number, contact_name')
    .or('is_deleted.is.null,is_deleted.eq.false')
    .in('contact_number', validRows.map((r) => r.contact_number));

  const existingSet = new Set(
    (existing ?? []).map((e) => `${e.contact_number}__${(e.contact_name as string).toLowerCase()}`)
  );

  const newRows = validRows.filter(
    (r) => !existingSet.has(`${r.contact_number}__${r.contact_name.toLowerCase()}`)
  );
  const duplicateCount = validRows.length - newRows.length;

  if (newRows.length > 0) {
    const { error: insertError } = await supabase.from('leads').insert(newRows);
    if (insertError) return { error: insertError.message };
  }

  revalidatePath(LEADS_PATH);
  return { imported: newRows.length, duplicates: duplicateCount, errors };
}

export async function updateLead(
  leadId: string,
  data: Partial<LeadImportRow> & { status?: LeadStatus }
): Promise<{ error?: string }> {
  const profile = await requireProfile();
  if (!['admin', 'super_admin'].includes(profile.role)) {
    return { error: 'Only admins can edit leads.' };
  }

  const parsed = leadRowSchema.partial().safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }

  const supabase = await createClient();
  const updatePayload: Record<string, any> = { ...parsed.data };
  if (data.status) {
    updatePayload.status = data.status;
  }
  updatePayload.updated_at = new Date().toISOString();

  const { error } = await supabase.from('leads').update(updatePayload).eq('id', leadId);
  if (error) return { error: error.message || 'Could not update lead.' };
  revalidatePath(LEADS_PATH);
  return {};
}

// Soft-delete a single lead
export async function deleteLead(leadId: string): Promise<{ error?: string }> {
  const profile = await requireProfile();
  if (!['admin', 'super_admin'].includes(profile.role)) {
    return { error: 'Only admins can delete leads.' };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from('leads')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: profile.id,
    })
    .eq('id', leadId);

  if (error) return { error: 'Could not delete lead.' };
  revalidatePath(LEADS_PATH);
  return {};
}

// Soft-delete multiple leads (bulk)
export async function bulkDeleteLeads(leadIds: string[]): Promise<{ error?: string; count?: number }> {
  const profile = await requireProfile();
  if (!['admin', 'super_admin'].includes(profile.role)) {
    return { error: 'Only admins can delete leads.' };
  }
  if (!leadIds || leadIds.length === 0) return { count: 0 };

  const supabase = await createClient();
  const { error } = await supabase
    .from('leads')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: profile.id,
    })
    .in('id', leadIds);

  if (error) return { error: 'Could not delete selected leads.' };
  revalidatePath(LEADS_PATH);
  return { count: leadIds.length };
}

// Bulk update status for multiple leads
export async function bulkUpdateLeadStatus(
  leadIds: string[],
  status: LeadStatus
): Promise<{ error?: string; count?: number }> {
  const check = await checkLeadPermission('edit');
  if (check.error) return { error: check.error };
  if (!leadIds || leadIds.length === 0) return { count: 0 };

  const supabase = await createClient();
  const { error } = await supabase
    .from('leads')
    .update({ status, updated_at: new Date().toISOString() })
    .in('id', leadIds);

  if (error) return { error: 'Could not update selected leads.' };
  revalidatePath(LEADS_PATH);
  return { count: leadIds.length };
}
