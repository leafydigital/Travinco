import { appendRowsToSheet, type SheetCell } from '@/lib/google-sheets';

/**
 * Helpers for permanent deletes. The rows are written to Google Sheets first;
 * the delete itself runs in a database function (supabase/hard_delete_migration.sql)
 * so it either removes everything or nothing.
 */

export const USERS_SHEET_TAB = 'Users';
export const CUSTOMERS_SHEET_TAB = 'Customers';

export const USERS_SHEET_HEADERS = [
  'ID', 'Full Name', 'Username', 'Email', 'Phone', 'Role', 'Status', 'Joined', 'Deleted At', 'Deleted By',
];

export const CUSTOMERS_SHEET_HEADERS = [
  'ID', 'Full Name', 'Phone', 'WhatsApp', 'Email', 'Address', 'City', 'State', 'Country', 'Source',
  'Notes', 'Active', 'Created At', 'Deleted At', 'Deleted By',
];

/** Saves rows to the sheet tab; returns an error message instead of throwing. */
export async function archiveRows(tab: string, headers: string[], rows: SheetCell[][]): Promise<string | null> {
  if (rows.length === 0) return null;
  try {
    await appendRowsToSheet(tab, headers, rows);
    return null;
  } catch (err) {
    console.error(`archive to "${tab}" sheet failed:`, err);
    return `Could not save the data to the Google Sheet "${tab}" tab, so nothing was deleted. Please try again.`;
  }
}

/** Readable message for an error from one of the hard_delete_* database functions. */
export function hardDeleteErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return 'Could not delete. Please try again.';
  if (error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message ?? '')) {
    return 'Permanent delete is not set up yet. Run supabase/hard_delete_migration.sql in the Supabase SQL editor.';
  }
  const stillLinked = error.message?.match(/Still linked to (\S+) records/);
  if (error.code === '23503' && stillLinked) {
    return `This record is still used in ${stillLinked[1]?.replace(/^public\./, '')}. Remove those first, then delete again.`;
  }
  if (error.code === '42501' || error.code === 'P0002') return error.message ?? 'Not allowed.';
  console.error('hard delete failed:', error);
  return 'Could not delete. Please try again.';
}

export function sheetValue(v: unknown): SheetCell {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.join(', ');
  return JSON.stringify(v);
}
