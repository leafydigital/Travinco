import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { canEditMasters } from '@/lib/tour/access';
import { EntityManager, type FieldDef, type ColumnDef } from '@/components/admin/entity-manager';
import { saveLocation, deleteLocation } from '@/lib/tour/master-actions';
import { BulkCreateLocationsButton } from './bulk-create-modal';
import { Suspense } from 'react';

export const metadata: Metadata = { title: 'Locations — Admin Portal' };

/* ── data (streamed) ──────────────────────────────────────── */
async function LocationsContent({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const supabase = await createClient();
  const [{ data: locs }, { data: hotels }, { data: acts }, { data: deletedSettingsData }] = await Promise.all([
    supabase.from('locations').select('*').order('sort_order').order('name'),
    supabase.from('hotels').select('location_id'),
    supabase.from('location_activities').select('location_id'),
    supabase.from('website_settings').select('key').like('key', 'deleted_location_%'),
  ]);

  const deletedLocationKeys = new Set(
    (deletedSettingsData || []).map((s: { key: string }) => s.key.replace('deleted_location_', ''))
  );

  const activeLocs = (locs ?? []).filter(
    (l: any) =>
      l &&
      l.is_deleted !== true &&
      l.is_deleted !== 'true' &&
      l.is_deleted !== 1 &&
      !deletedLocationKeys.has(String(l.id))
  );

  const count = (list: { location_id: number }[] | null, id: number) => (list ?? []).filter((x) => x.location_id === id).length;
  const nameOf = Object.fromEntries(activeLocs.map((l) => [String(l.id), l.display_name || l.name]));
  const rows = activeLocs.map((l) => ({
    ...l,
    hotels: count(hotels, l.id),
    activities: count(acts, l.id),
    type: l.is_houseboat ? 'Houseboat' : 'Town',
  }));

  // Extract unique states present in the table (removing hardcoded seed list)
  const tableStates = Array.from(
    new Set(
      activeLocs
        .map((l) => (typeof l.state === 'string' ? l.state.trim() : ''))
        .filter(Boolean)
    )
  ).sort();

  const fields: FieldDef[] = [
    { name: 'name', label: 'Name (as in the Rate Master)', type: 'text', required: true, hint: 'Must match the Location column of the Rate Master sheet.' },
    { name: 'display_name', label: 'Name shown on quotations', type: 'text', placeholder: 'Leave blank to use the name' },
    { name: 'state', label: 'State', type: 'select', options: tableStates.map((s) => ({ value: s, label: s })) },
    {
      name: 'parent_id', label: 'Part of (main town)', type: 'select',
      options: activeLocs.map((l) => ({ value: String(l.id), label: l.display_name || l.name })),
      hint: 'e.g. Fort Kochi → Cochin. Hotels there are offered for Cochin stays.',
    },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'sort_order', label: 'Sort order', type: 'number', step: '1' },
    { name: 'is_houseboat', label: 'Houseboat location (priced per boat, all meals)', type: 'checkbox', span: 2 },
    { name: 'is_active', label: 'Active', type: 'checkbox' },
  ];
  const columns: ColumnDef[] = [
    { key: 'name', label: 'Location', sub: 'display_name' },
    { key: 'state', label: 'State' },
    { key: 'parent_id', label: 'Part of', format: 'lookup', lookup: nameOf },
    { key: 'type', label: 'Type', format: 'badge' },
    { key: 'hotels', label: 'Hotels', align: 'right' },
    { key: 'activities', label: 'Activities', align: 'right' },
    { key: 'is_active', label: 'Active', format: 'bool', align: 'center' },
  ];

  return (
    <EntityManager
      rows={rows}
      fields={fields}
      columns={columns}
      canEdit={canEdit}
      canDelete={canDelete}
      saveAction={saveLocation}
      deleteAction={deleteLocation}
      searchKeys={['name', 'display_name', 'state']}
      filters={[{ key: 'state', label: 'States', options: tableStates.map((s) => ({ value: s, label: s })) }]}
      newLabel="Add location"
      entityName="location"
      defaults={{ state: tableStates[0] || 'Kerala', is_active: true, is_houseboat: false, sort_order: 100 }}
      headerActions={
        <BulkCreateLocationsButton
          parentLocations={activeLocs.map((l) => ({
            id: l.id,
            name: l.name,
            display_name: l.display_name,
          }))}
          states={tableStates}
        />
      }
    />
  );
}

/* ── page shell (instant) ─────────────────────────────────── */
export default async function LocationsPage() {
  const profile = await requireProfile();
  const editable = canEditMasters(profile);
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Locations</h1>
        <p className="text-sm text-ink-500">Manage destination locations used in tours and quotations.</p>
      </div>
      <Suspense fallback={
        <div className="card p-6">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-ink-100" />
            ))}
          </div>
        </div>
      }>
        <LocationsContent canEdit={editable} canDelete={isAdmin} />
      </Suspense>
    </div>
  );
}
