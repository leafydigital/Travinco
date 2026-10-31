'use server';

import { requireProfile, assertRole, assertPageAccess } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import {
  importRateMasterBatch,
  type ImportRateMasterResult,
} from '@/lib/services/rate-master-import';
import {
  getMasterRatesFromDb,
  getMasterRateByIdFromDb,
  deleteMasterRateFromDb,
  clearAllMasterRatesFromDb,
  getMasterFilterOptions,
  type RateMasterQueryParams,
  type RateMasterQueryResult,
  type MasterFilterOptions,
} from '@/lib/services/master-rates-db';
import type { MasterHotelRateItem } from '@/lib/excel/master-parser';
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

    revalidatePath('/travinco_dashboard/master');

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
  await assertPageAccess(profile, 'master');

  return getMasterRatesFromDb(params);
}

/**
 * Fetches complete details of a single master rate for on-demand editing.
 */
export async function getMasterRateByIdAction(
  rateId: string | number
): Promise<{ data?: MasterHotelRateItem; error?: string }> {
  try {
    const profile = await requireProfile();
    await assertPageAccess(profile, 'master');

    const rate = await getMasterRateByIdFromDb(rateId);
    if (!rate) {
      return { error: 'Rate record not found.' };
    }
    return { data: rate };
  } catch (err: unknown) {
    console.error('Error in getMasterRateByIdAction:', err);
    return { error: 'Could not fetch rate details.' };
  }
}

/**
 * Fetches distinct filter choices for dropdown menus.
 */
export async function getMasterFiltersAction(): Promise<MasterFilterOptions> {
  const profile = await requireProfile();
  await assertPageAccess(profile, 'master');

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
    revalidatePath('/travinco_dashboard/master');
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
    revalidatePath('/travinco_dashboard/master');
    return { success: true };
  } catch (err: unknown) {
    console.error('Clear master rates error:', err);
    return { success: false, error: 'Could not clear master rates.' };
  }
}

/**
 * Updates a specific master rate item (CP, MAP, extra beds, notes).
 */
export async function updateMasterRateAction(
  rateId: string | number,
  data: {
    cpCost?: number | null;
    mapCost?: number | null;
    extraAdultCP?: number | null;
    extraAdultMAP?: number | null;
    childBedCost?: number | null;
    childNoBedCost?: number | null;
    notes?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const profile = await requireProfile();
    assertRole(profile, ['admin', 'super_admin']);

    const supabase = await createClient();
    const idNum = typeof rateId === 'string' ? parseInt(rateId, 10) : rateId;
    if (isNaN(idNum)) {
      return { success: false, error: 'Invalid rate ID.' };
    }

    const costs: [string, number | null | undefined][] = [
      ['CP cost', data.cpCost],
      ['MAP cost', data.mapCost],
      ['Extra adult (CP)', data.extraAdultCP],
      ['Extra adult (MAP)', data.extraAdultMAP],
      ['Child with bed', data.childBedCost],
      ['Child without bed', data.childNoBedCost],
    ];
    for (const [label, value] of costs) {
      if (value == null) continue;
      if (!Number.isFinite(value)) return { success: false, error: `${label} must be a number.` };
      if (value < 0) return { success: false, error: `${label} cannot be negative.` };
    }

    const { error } = await supabase
      .from('room_rates')
      .update({
        cp_cost: data.cpCost !== undefined ? data.cpCost : null,
        map_cost: data.mapCost !== undefined ? data.mapCost : null,
        extra_adult_cp: data.extraAdultCP !== undefined ? data.extraAdultCP : null,
        extra_adult_map: data.extraAdultMAP !== undefined ? data.extraAdultMAP : null,
        child_bed_cost: data.childBedCost !== undefined ? data.childBedCost : null,
        child_no_bed_cost: data.childNoBedCost !== undefined ? data.childNoBedCost : null,
        notes: data.notes !== undefined ? data.notes : null,
      })
      .eq('id', idNum);

    if (error) {
      console.error('Error updating master rate in DB:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/travinco_dashboard/master');
    return { success: true };
  } catch (err: unknown) {
    console.error('Update master rate error:', err);
    return { success: false, error: 'Could not update the rate record.' };
  }
}

