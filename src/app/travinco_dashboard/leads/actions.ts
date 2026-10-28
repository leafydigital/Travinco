'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile, checkModulePermission } from '@/lib/supabase/auth-helpers';
import { revalidatePath } from 'next/cache';
import { hasActiveRows, fetchAllActiveRows, softDeleteRows } from '@/lib/archive-to-sheet';
import { appendRowsToSheet } from '@/lib/google-sheets';
import { z } from 'zod';

const LEADS_PATH = '/travinco_dashboard/leads';

export type LeadStatus = 'fresh_lead' | 'follow_up' | 'interested' | 'not_interested' | 'enquired' | 'converted';

async function checkLeadPermission(action: 'view' | 'edit' = 'edit') {
  const profile = await requireProfile();
  const perm = await checkModulePermission(profile, 'leads' as any, action);
  if (!perm.allowed && !['super_admin', 'admin', 'sales_staff', 'accounts_staff'].includes(profile.role)) {
    return { error: 'Access restricted: Your user role does not have permission to manage leads. Please contact an administrator.' };
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
  contact_name: z
    .string({ required_error: 'Contact Name is required' })
    .trim()
    .min(1, 'Contact Name is required')
    .max(120, 'Contact Name must be under 120 characters'),
  contact_number: z
    .string({ required_error: 'Contact Number is required' })
    .trim()
    .min(4, 'Contact Number is too short (minimum 4 digits)')
    .max(30, 'Contact Number must be under 30 characters'),
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address (e.g. name@example.com)')
    .optional()
    .or(z.literal('')),
  package: z
    .string()
    .trim()
    .max(200, 'Package title must be under 200 characters')
    .optional()
    .or(z.literal('')),
  number_of_days: z
    .preprocess((val) => {
      if (val === '' || val === null || val === undefined) return null;
      const n = Number(String(val).trim());
      return isNaN(n) ? val : n;
    }, z.number({ invalid_type_error: 'Number of Days must be a number' }).int('Number of Days must be a whole number').min(0, 'Number of Days cannot be negative').nullable().optional()),
  budget: z
    .preprocess((val) => {
      if (val === '' || val === null || val === undefined) return null;
      if (typeof val === 'number') return isNaN(val) ? val : val;
      const clean = String(val).replace(/[₹$€,\s]/g, '').replace(/rs\.?/gi, '').trim();
      const n = Number(clean);
      return isNaN(n) ? val : n;
    }, z.number({ invalid_type_error: 'Budget must be a valid number (e.g. 25000)' }).min(0, 'Budget cannot be negative').nullable().optional()),
  from_date: z.string().optional().nullable(),
  to_date: z.string().optional().nullable(),
  number_of_people: z
    .preprocess((val) => {
      if (val === '' || val === null || val === undefined) return null;
      const n = Number(String(val).trim());
      return isNaN(n) ? val : n;
    }, z.number({ invalid_type_error: 'Number of People must be a number' }).int('Number of People must be a whole number').min(0, 'Number of People cannot be negative').nullable().optional()),
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
      const issue = parsed.error.issues[0];
      errors.push(`Row ${i + 1}: ${issue?.message ?? 'Please check the entered data.'}`);
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
    if (insertError) {
      console.error('Lead import database error:', insertError.message);
      return {
        error:
          'We were unable to save the leads to the database. Please verify your data formatting and try again.',
      };
    }
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

export interface LeadTableItem {
  id: string;
  contact_name: string;
  contact_number: string;
  email: string | null;
  package: string | null;
  number_of_days: number | null;
  budget: number | null;
  from_date: string | null;
  to_date: string | null;
  number_of_people: number | null;
  status: LeadStatus;
  created_at: string;
}

export interface LeadsTableQueryResult {
  leads: LeadTableItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

/**
 * Fast, lean query for leads table with database pagination and filtering.
 */
export async function getLeadsTableList({
  page = 1,
  pageSize = 20,
  q = '',
  status = '',
}: {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
} = {}): Promise<LeadsTableQueryResult> {
  const check = await checkLeadPermission('view');
  if (check.error) {
    throw new Error(check.error);
  }

  const supabase = await createClient();

  const currentPage = Math.max(1, page);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('leads')
    .select(
      'id, contact_name, contact_number, email, package, number_of_days, budget, from_date, to_date, number_of_people, status, created_at, is_deleted',
      { count: 'exact' }
    )
    .or('is_deleted.is.null,is_deleted.eq.false')
    .order('created_at', { ascending: false });

  if (q && q.trim()) {
    const term = q.trim();
    query = query.or(
      `contact_name.ilike.%${term}%,contact_number.ilike.%${term}%,email.ilike.%${term}%,package.ilike.%${term}%`
    );
  }

  if (status && status.trim()) {
    query = query.eq('status', status.trim() as any);
  }

  const { data: leadsData, count, error } = await query.range(from, to);

  if (error) {
    console.error('getLeadsTableList query error:', error.message);
  }

  const rows = leadsData || [];
  const visibleLeads = rows.filter((r: any) => r.is_deleted !== true);

  const items: LeadTableItem[] = visibleLeads.map((row: any) => ({
    id: row.id,
    contact_name: row.contact_name,
    contact_number: row.contact_number,
    email: row.email || null,
    package: row.package || null,
    number_of_days: row.number_of_days ?? null,
    budget: row.budget ? Number(row.budget) : null,
    from_date: row.from_date || null,
    to_date: row.to_date || null,
    number_of_people: row.number_of_people ?? null,
    status: row.status as LeadStatus,
    created_at: row.created_at,
  }));

  const totalCount = count ?? items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    leads: items,
    totalCount,
    totalPages,
    page: currentPage,
    pageSize,
  };
}


// ─── Clear Data: archive all leads to Google Sheets, then soft-delete ─────────
const LEADS_SHEET_HEADERS = [
  'ID', 'Contact Name', 'Contact Number', 'Email', 'Package', 'Days', 'Budget',
  'From Date', 'To Date', 'People', 'Status', 'Source', 'Import Batch',
  'Created At', 'Cleared At', 'Cleared By',
];

export async function clearAndArchiveLeads(): Promise<{ error?: string; count?: number }> {
  const profile = await requireProfile();
  if (!['admin', 'super_admin'].includes(profile.role)) {
    return { error: 'Only admins can clear leads data.' };
  }

  try {
    // Fast exit: nothing to archive, skip the full fetch and Google entirely
    if (!(await hasActiveRows('leads'))) return { count: 0 };


    const leads = await fetchAllActiveRows<Record<string, any>>('leads');
    if (leads.length === 0) return { count: 0 };

    const clearedAt = new Date().toISOString();
    const clearedBy = profile.full_name || profile.email;
    const rows = leads.map((l) => [
      l.id, l.contact_name, l.contact_number, l.email, l.package, l.number_of_days, l.budget,
      l.from_date, l.to_date, l.number_of_people, l.status, l.source, l.import_batch,
      l.created_at, clearedAt, clearedBy,
    ]);

    // Only clear the table once the sheet write has succeeded
    await appendRowsToSheet('Leads', LEADS_SHEET_HEADERS, rows);
    await softDeleteRows('leads', leads.map((l) => l.id), profile.id);

    revalidatePath(LEADS_PATH);
    revalidatePath('/travinco_dashboard');
    return { count: leads.length };
  } catch (err) {
    console.error('clearAndArchiveLeads failed:', err);
    return { error: 'Could not archive leads to Google Sheets. No data was cleared.' };
  }
}
