import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { canEditMasters } from '@/lib/tour/access';
import { EntityManager, type FieldDef, type ColumnDef } from '@/components/admin/entity-manager';
import { saveDistance, deleteDistance } from '@/lib/tour/master-actions';
import { BulkCreateDistancesButton } from './bulk-create-modal';

export const metadata: Metadata = { title: 'Distances — Admin Portal' };

export default async function DistancesPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ data: dists }, { data: locs }, { data: deletedDistSettings }, { data: deletedLocSettings }] = await Promise.all([
    supabase.from('location_distances').select('*'),
    supabase.from('locations').select('id, name, display_name').order('sort_order').order('name'),
    supabase.from('website_settings').select('key').like('key', 'deleted_distance_%'),
    supabase.from('website_settings').select('key').like('key', 'deleted_location_%'),
  ]);

  const deletedDistKeys = new Set(
    (deletedDistSettings || []).map((s: { key: string }) => s.key.replace('deleted_distance_', ''))
  );
  const deletedLocKeys = new Set(
    (deletedLocSettings || []).map((s: { key: string }) => s.key.replace('deleted_location_', ''))
  );

  const activeLocs = (locs ?? []).filter(
    (l: any) => l && l.is_deleted !== true && l.is_deleted !== 'true' && l.is_deleted !== 1 && !deletedLocKeys.has(String(l.id))
  );

  const activeDists = (dists ?? []).filter(
    (d: any) =>
      d &&
      d.is_deleted !== true &&
      d.is_deleted !== 'true' &&
      d.is_deleted !== 1 &&
      !deletedDistKeys.has(String(d.id))
  );

  const name = (id: number) => {
    const l = activeLocs.find((x) => x.id === id);
    return l ? l.display_name || l.name : `#${id}`;
  };
  const locOptions = activeLocs.map((l) => ({ value: String(l.id), label: l.display_name || l.name }));
  const rows = activeDists
    .map((d) => ({ ...d, route: `${name(d.from_location_id)} ↔ ${name(d.to_location_id)}`, from_name: name(d.from_location_id), to_name: name(d.to_location_id) }))
    .sort((a, b) => a.route.localeCompare(b.route));

  const fields: FieldDef[] = [
    { name: 'from_location_id', label: 'From', type: 'select', required: true, options: locOptions },
    { name: 'to_location_id', label: 'To', type: 'select', required: true, options: locOptions },
    { name: 'distance_km', label: 'Distance (km)', type: 'number', required: true },
    { name: 'duration_text', label: 'Drive time', type: 'text', placeholder: '3.5–4 hrs' },
    { name: 'notes', label: 'Notes', type: 'textarea', rows: 2, placeholder: 'Route, ghat roads…' },
  ];
  const columns: ColumnDef[] = [
    { key: 'route', label: 'Route', sub: 'notes' },
    { key: 'distance_km', label: 'Distance', format: 'km', align: 'right' },
    { key: 'duration_text', label: 'Drive time' },
  ];

  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-500">
        One entry per pair works both ways. Quotations add these up (plus pickup/drop distances and local sightseeing running) to estimate vehicle kilometres.
      </p>
      <EntityManager
        rows={rows}
        fields={fields}
        columns={columns}
        canEdit={canEditMasters(profile)}
        canDelete={isAdmin}
        saveAction={saveDistance}
        deleteAction={deleteDistance}
        searchKeys={['route']}
        newLabel="Add distance"
        entityName="distance"
        headerActions={
          <BulkCreateDistancesButton
            locations={activeLocs.map((l) => ({
              id: l.id,
              name: l.name,
              display_name: l.display_name,
            }))}
          />
        }
      />
    </div>
  );
}
