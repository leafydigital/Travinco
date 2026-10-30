import 'server-only';
import type { createClient } from '@/lib/supabase/server';

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Destinations offered in the package form's Destination dropdown: the same set the
 * Destinations page lists (soft-deleted rows and `deleted_destination_<id>` markers
 * are left out).
 */
export async function getDestinationOptions(
  supabase: ServerClient
): Promise<{ id: string; name: string }[]> {
  const [{ data: rows }, { data: deletedMarkers }] = await Promise.all([
    supabase.from('destinations').select('id, name, is_deleted').order('name'),
    supabase.from('website_settings').select('key').like('key', 'deleted_destination_%'),
  ]);

  const deleted = new Set(
    (deletedMarkers ?? []).map((s: { key: string }) => s.key.replace('deleted_destination_', ''))
  );

  return (rows ?? [])
    .filter((d: any) => d.is_deleted !== true && !deleted.has(d.id))
    .map((d: any) => ({ id: d.id as string, name: d.name as string }));
}
