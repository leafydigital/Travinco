import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { assertTourAccess, canEditMasters } from '@/lib/tour/access';
import { EntityManager, type FieldDef, type ColumnDef } from '@/components/admin/entity-manager';
import { saveTransportVehicle, deleteTransportVehicle } from '@/lib/tour/master-actions';
import { Suspense } from 'react';

export const metadata: Metadata = { title: 'Transportation — Admin Portal' };

const CAR_TYPES = [
  'Sedan (Dzire / Etios)',
  'Ertiga',
  'Innova',
  'Innova Crysta',
  'Tempo Traveller (12 seater)',
  'Tempo Traveller (17 seater)',
  'Mini Bus (26 seater)',
  'Coach (35+ seater)',
];

const fields: FieldDef[] = [
  { name: 'vehicle_type', label: 'Car type', type: 'text', required: true, placeholder: 'e.g. Innova Crysta', hint: 'Use the same name across companies so quotes can match them.' },
  { name: 'company_name', label: 'Company name', type: 'text', required: true },
  { name: 'contact_person', label: 'Contact person', type: 'text' },
  { name: 'contact_number', label: 'Contact number', type: 'tel', required: true },
  { name: 'alt_contact_number', label: 'Alternate number', type: 'tel' },
  { name: 'seats', label: 'Seats', type: 'number', step: '1' },
  {
    name: 'rate_basis', label: 'Amount is charged', type: 'select', required: true,
    options: [{ value: 'per_day', label: 'Per day' }, { value: 'per_trip', label: 'Per trip (whole package)' }],
  },
  { name: 'amount', label: 'Amount given (₹)', type: 'number', required: true },
  { name: 'free_km', label: 'Free kilometres', type: 'number', step: '1', required: true, hint: 'Per day when charged per day; total when charged per trip.' },
  { name: 'extra_per_km', label: 'Extra amount per km (₹)', type: 'number', required: true },
  { name: 'driver_bata_per_day', label: 'Driver bata per day (₹)', type: 'number', hint: 'Leave 0 if included in the amount.' },
  { name: 'is_ac', label: 'Air-conditioned', type: 'checkbox' },
  { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Night halt, permits, parking, toll terms…' },
  { name: 'is_active', label: 'Active (offered in quotations)', type: 'checkbox' },
];

const columns: ColumnDef[] = [
  { key: 'vehicle_type', label: 'Car type', sub: 'seats_label' },
  { key: 'company_name', label: 'Company', sub: 'contact_person' },
  { key: 'contact_number', label: 'Contact', sub: 'alt_contact_number' },
  { key: 'rate_label', label: 'Amount', align: 'right' },
  { key: 'free_label', label: 'Free km', align: 'right' },
  { key: 'extra_per_km', label: 'Extra / km', format: 'money', align: 'right' },
  { key: 'driver_bata_per_day', label: 'Bata / day', format: 'money', align: 'right' },
  { key: 'is_active', label: 'Active', format: 'bool', align: 'center' },
];

/* ── data (streamed) ──────────────────────────────────────── */
async function TransportContent({ canEdit }: { canEdit: boolean }) {
  const supabase = await createClient();
  const { data } = await supabase.from('transport_vehicles').select('*').order('vehicle_type').order('company_name');

  const rows = (data ?? []).map((v) => ({
    ...v,
    rate_label: `₹${Math.round(Number(v.amount)).toLocaleString('en-IN')} ${v.rate_basis === 'per_day' ? '/ day' : '/ trip'}`,
    free_label: `${v.free_km} km ${v.rate_basis === 'per_day' ? '/ day' : '/ trip'}`,
    seats_label: [v.seats ? `${v.seats} seats` : null, v.is_ac ? 'A/C' : 'Non A/C'].filter(Boolean).join(' · '),
  }));
  const types = Array.from(new Set([...CAR_TYPES, ...rows.map((r) => r.vehicle_type)]));

  return (
    <EntityManager
      rows={rows}
      fields={fields}
      columns={columns}
      canEdit={canEdit}
      saveAction={saveTransportVehicle}
      deleteAction={deleteTransportVehicle}
      searchKeys={['vehicle_type', 'company_name', 'contact_person', 'contact_number']}
      filters={[{ key: 'vehicle_type', label: 'Car types', options: types.map((t) => ({ value: t, label: t })) }]}
      newLabel="Add vehicle"
      entityName="vehicle"
      emptyText="No vehicles yet. Add your transport companies and their car types."
      defaults={{ rate_basis: 'per_day', is_ac: true, is_active: true, free_km: 250, extra_per_km: 0, driver_bata_per_day: 0 }}
    />
  );
}

/* ── page shell (instant) ─────────────────────────────────── */
export default async function TransportPage() {
  const profile = await requireProfile();
  assertTourAccess(profile, 'masters');
  const editable = canEditMasters(profile);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Transportation</h1>
        <p className="text-sm text-ink-500">
          Vehicles and transport companies. Quotations charge the amount, then extra kilometres above the free limit at the per-km rate.
        </p>
      </div>
      <Suspense fallback={
        <div className="card p-6">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-ink-100" />
            ))}
          </div>
        </div>
      }>
        <TransportContent canEdit={editable} />
      </Suspense>
    </div>
  );
}
