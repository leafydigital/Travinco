import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { assertTourAccess, canEditMasters } from '@/lib/tour/access';
import { EntityManager, type FieldDef, type ColumnDef } from '@/components/admin/entity-manager';
import { savePickupPoint, deletePickupPoint } from '@/lib/tour/master-actions';
import { Suspense } from 'react';

export const metadata: Metadata = { title: 'Pickup & Drop Points — Admin Portal' };

const TYPES = [
  { value: 'airport', label: 'Airport' },
  { value: 'railway', label: 'Railway station' },
  { value: 'bus', label: 'Bus stand' },
  { value: 'hotel', label: 'Hotel / residence' },
  { value: 'port', label: 'Port / jetty' },
  { value: 'other', label: 'Other' },
];

/* ── data (streamed) ──────────────────────────────────────── */
async function PickupPointsContent({ canEdit }: { canEdit: boolean }) {
  const supabase = await createClient();
  const [{ data: points }, { data: locs }] = await Promise.all([
    supabase.from('pickup_drop_points').select('*').order('sort_order').order('name'),
    supabase.from('locations').select('id, name, display_name').order('sort_order').order('name'),
  ]);

  const locLookup = Object.fromEntries((locs ?? []).map((l) => [String(l.id), l.display_name || l.name]));
  const typeLookup = Object.fromEntries(TYPES.map((t) => [t.value, t.label]));
  const rows = (points ?? []).map((p) => ({
    ...p,
    used_for: [p.use_for_pickup && 'Pickup', p.use_for_drop && 'Drop'].filter(Boolean).join(' & ') || '—',
  }));

  const fields: FieldDef[] = [
    { name: 'name', label: 'Name', type: 'text', required: true, span: 2, placeholder: 'e.g. Cochin International Airport (COK)' },
    { name: 'code', label: 'Short code', type: 'text', placeholder: 'COK' },
    { name: 'point_type', label: 'Type', type: 'select', required: true, options: TYPES },
    {
      name: 'location_id', label: 'Nearest town (location)', type: 'select',
      options: (locs ?? []).map((l) => ({ value: String(l.id), label: l.display_name || l.name })),
      hint: 'Used to plan the first and last day of the itinerary.',
    },
    { name: 'km_from_location', label: 'Distance to town (km)', type: 'number', hint: 'Added to the vehicle kilometres.' },
    { name: 'address', label: 'Address', type: 'textarea', rows: 2 },
    { name: 'google_maps_url', label: 'Google Maps link', type: 'url', span: 2 },
    { name: 'contact_phone', label: 'Contact phone', type: 'tel' },
    { name: 'sort_order', label: 'Sort order', type: 'number', step: '1' },
    { name: 'use_for_pickup', label: 'Offer as pickup point', type: 'checkbox' },
    { name: 'use_for_drop', label: 'Offer as drop point', type: 'checkbox' },
    { name: 'notes', label: 'Notes', type: 'textarea', rows: 2, placeholder: 'Meeting point, parking, terminal…' },
    { name: 'is_active', label: 'Active', type: 'checkbox' },
  ];

  const columns: ColumnDef[] = [
    { key: 'name', label: 'Point', sub: 'address' },
    { key: 'code', label: 'Code' },
    { key: 'point_type', label: 'Type', format: 'badge', lookup: typeLookup },
    { key: 'location_id', label: 'Town', format: 'lookup', lookup: locLookup },
    { key: 'km_from_location', label: 'To town', format: 'km', align: 'right' },
    { key: 'used_for', label: 'Used for' },
    { key: 'is_active', label: 'Active', format: 'bool', align: 'center' },
  ];

  return (
    <EntityManager
      rows={rows}
      fields={fields}
      columns={columns}
      canEdit={canEdit}
      saveAction={savePickupPoint}
      deleteAction={deletePickupPoint}
      searchKeys={['name', 'code', 'address']}
      filters={[{ key: 'point_type', label: 'Types', options: TYPES }]}
      newLabel="Add point"
      entityName="point"
      defaults={{ point_type: 'airport', use_for_pickup: true, use_for_drop: true, is_active: true, km_from_location: 0, sort_order: 100 }}
    />
  );
}

/* ── page shell (instant) ─────────────────────────────────── */
export default async function PickupPointsPage() {
  const profile = await requireProfile();
  assertTourAccess(profile, 'masters');
  const editable = canEditMasters(profile);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Pickup &amp; Drop Points</h1>
        <p className="text-sm text-ink-500">Airports, stations and other places where guests are picked up or dropped.</p>
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
        <PickupPointsContent canEdit={editable} />
      </Suspense>
    </div>
  );
}
