'use server';

import { requireProfile, assertRole } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import {
  importRateMasterBatch,
  type ImportRateMasterResult,
} from '@/lib/services/rate-master-import';
import {
  getMasterRatesFromDb,
  deleteMasterRateFromDb,
  clearAllMasterRatesFromDb,
  getMasterFilterOptions,
  type RateMasterQueryParams,
  type RateMasterQueryResult,
  type MasterFilterOptions,
} from '@/lib/services/master-rates-db';
import { revalidatePath } from 'next/cache';

export interface UploadActionResult {
  success: boolean;
  batchId?: number;
  count?: number;
  insertedCount?: number;
  updatedCount?: number;
  skippedCount?: number;
  totalRows?: number;
  warningCount?: number;
  errorCount?: number;
  errors?: string[];
  warnings?: string[];
  sheetName?: string;
  isDuplicate?: boolean;
}

/**
 * Handles uploading and validating an Excel file, importing data into relational PostgreSQL tables.
 */
export async function uploadMasterExcelAction(formData: FormData): Promise<UploadActionResult> {
  const profile = await requireProfile();
  assertRole(profile, ['admin', 'super_admin']);

  const file = formData.get('file') as File | null;
  if (!file || typeof file === 'string' || file.size === 0) {
    return {
      success: false,
      errors: ['Please select a valid Excel file to upload.'],
    };
  }

  // Validate filename extension
  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
    return {
      success: false,
      errors: ['Only Excel files (.xlsx or .xls) are allowed.'],
    };
  }

  // Check file size limit (15MB)
  if (file.size > 15 * 1024 * 1024) {
    return {
      success: false,
      errors: ['Excel file size exceeds the 15MB limit.'],
    };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const supabase = await createClient();

    const importResult = await importRateMasterBatch({
      fileBuffer: buffer,
      fileName: file.name,
      userId: profile.id,
      allowDuplicate: true,
      supabaseClient: supabase,
    });

    revalidatePath('/admin/master');

    return {
      success: importResult.success,
      batchId: importResult.batchId,
      count: importResult.importedCount,
      insertedCount: importResult.insertedCount,
      updatedCount: importResult.updatedCount,
      skippedCount: importResult.skippedCount,
      totalRows: importResult.totalRows,
      warningCount: importResult.warningCount,
      errorCount: importResult.errorCount,
      errors: importResult.errors,
      warnings: importResult.warnings,
      sheetName: importResult.sheetName,
      isDuplicate: importResult.isDuplicate,
    };
  } catch (err: unknown) {
    console.error('Master Excel upload error:', err);
    return {
      success: false,
      errors: [
        `An unexpected error occurred: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }
}

/**
 * Fetches filtered & paginated rate master records from DB.
 */
export async function getMasterRatesAction(
  params: RateMasterQueryParams = {}
): Promise<RateMasterQueryResult> {
  const profile = await requireProfile();
  assertRole(profile, ['admin', 'super_admin']);

  return getMasterRatesFromDb(params);
}

/**
 * Fetches distinct filter choices for dropdown menus.
 */
export async function getMasterFiltersAction(): Promise<MasterFilterOptions> {
  const profile = await requireProfile();
  assertRole(profile, ['admin', 'super_admin']);

  return getMasterFilterOptions();
}

/**
 * Deletes a specific master rate item by ID from the database.
 */
export async function deleteMasterRateAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const profile = await requireProfile();
    assertRole(profile, ['admin', 'super_admin']);

    const supabase = await createClient();
    const ok = await deleteMasterRateFromDb(id, supabase);
    if (!ok) {
      return { success: false, error: 'Could not delete the rate record from database.' };
    }
    revalidatePath('/admin/master');
    return { success: true };
  } catch (err: unknown) {
    console.error('Delete master rate error:', err);
    return { success: false, error: 'Could not delete the rate record.' };
  }
}

/**
 * Clears all master rates stored in the database.
 */
export async function clearAllMasterRatesAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const profile = await requireProfile();
    assertRole(profile, ['admin', 'super_admin']);

    const supabase = await createClient();
    const ok = await clearAllMasterRatesFromDb(supabase);
    if (!ok) {
      return { success: false, error: 'Could not clear master rates from database.' };
    }
    revalidatePath('/admin/master');
    return { success: true };
  } catch (err: unknown) {
    console.error('Clear master rates error:', err);
    return { success: false, error: 'Could not clear master rates.' };
  }
}
