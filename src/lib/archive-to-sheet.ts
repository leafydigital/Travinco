import { createServiceClient } from '@/lib/supabase/service';

const PAGE_SIZE = 1000;

/** Cheap existence check (single row, id only) so an empty table returns immediately. */
export async function hasActiveRows(table: 'leads' | 'enquiries'): Promise<boolean> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .or('is_deleted.is.null,is_deleted.eq.false')
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

/** Fetches every non-deleted row of a table in pages of 1000 (Supabase max per request). */
export async function fetchAllActiveRows<T = Record<string, unknown>>(
  table: 'leads' | 'enquiries',
  columns = '*'
): Promise<T[]> {
  const supabase = createServiceClient();
  const all: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    all.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return all;
}

/** Soft-deletes the given ids in chunks (keeps URL length safe for large lists). */
export async function softDeleteRows(table: 'leads' | 'enquiries', ids: string[], deletedBy: string) {
  const supabase = createServiceClient();
  const deletedAt = new Date().toISOString();
  const CHUNK = 200;

  for (let i = 0; i < ids.length; i += CHUNK) {
    const { error } = await supabase
      .from(table)
      .update({ is_deleted: true, deleted_at: deletedAt, deleted_by: deletedBy } as any)
      .in('id', ids.slice(i, i + CHUNK));
    if (error) throw new Error(error.message);
  }
}
