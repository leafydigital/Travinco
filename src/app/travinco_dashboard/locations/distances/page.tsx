import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { canEditMasters } from '@/lib/tour/access';
import { EntityManager, type FieldDef, type ColumnDef } from '@/components/admin/entity-manager';
import { saveDistance, deleteDistance } from '@/lib/tour/master-actions';

export const metadata: Metadata = { title: 'Distances — Admin Portal' };

export default async function DistancesPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ data: dists }, { data: locs }] = await Promise.all([
    supabase.from('location_distances').select('*'),
    supabase.from('locations').select('id, name, display_name').order('sort_order').order('name'),
  ]);
  const name = (id: number) => {
    const l = (locs ?? []).find((x) => x.id === id);
    return l ? l.display_name || l.name : `#${id}`;
  };
  const locOptions = (locs ?? []).map((l) => ({ value: String(l.id), label: l.display_name || l.name }));
  const rows = (dists ?? [])
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
        saveAction={saveDistance}
        deleteAction={deleteDistance}
        searchKeys={['route']}
        newLabel="Add distance"
        entityName="distance"
      />
    </div>
  );
}
