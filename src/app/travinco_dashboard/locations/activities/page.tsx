import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { canEditMasters } from '@/lib/tour/access';
import { ActivitiesClient } from './activities-client';

export const metadata: Metadata = { title: 'Sightseeing & Activities — Admin Portal' };

export default async function ActivitiesPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ data: acts }, { data: locs }, { data: deletedActSettings }, { data: deletedLocSettings }] = await Promise.all([
    supabase.from('location_activities').select('*').order('location_id').order('sort_order').order('name'),
    supabase.from('locations').select('id, name, display_name').order('sort_order').order('name'),
    supabase.from('website_settings').select('key').like('key', 'deleted_activity_%'),
    supabase.from('website_settings').select('key').like('key', 'deleted_location_%'),
  ]);

  const deletedActKeys = new Set(
    (deletedActSettings || []).map((s: { key: string }) => s.key.replace('deleted_activity_', ''))
  );
  const deletedLocKeys = new Set(
    (deletedLocSettings || []).map((s: { key: string }) => s.key.replace('deleted_location_', ''))
  );

  const activeLocs = (locs ?? []).filter(
    (l: any) => l && l.is_deleted !== true && l.is_deleted !== 'true' && l.is_deleted !== 1 && !deletedLocKeys.has(String(l.id))
  );

  const activeActs = (acts ?? []).filter(
    (a: any) =>
      a &&
      a.is_deleted !== true &&
      a.is_deleted !== 'true' &&
      a.is_deleted !== 1 &&
      !deletedActKeys.has(String(a.id))
  );

  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
  const canEdit = canEditMasters(profile);

  return (
    <ActivitiesClient
      initialActivities={activeActs}
      locations={activeLocs}
      isAdmin={isAdmin}
      canEdit={canEdit}
    />
  );
}
