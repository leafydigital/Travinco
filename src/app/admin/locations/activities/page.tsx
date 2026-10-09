import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { canEditMasters } from '@/lib/tour/access';
import { EntityManager, type FieldDef, type ColumnDef } from '@/components/admin/entity-manager';
import { saveActivity, deleteActivity } from '@/lib/tour/master-actions';

export const metadata: Metadata = { title: 'Sightseeing & Activities — Admin Portal' };

const KINDS = [
  { value: 'sightseeing', label: 'Sightseeing' },
  { value: 'activity', label: 'Activity' },
  { value: 'experience', label: 'Experience / show' },
  { value: 'temple', label: 'Temple / pilgrimage' },
  { value: 'shopping', label: 'Shopping' },
];

export default async function ActivitiesPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ data: acts }, { data: locs }] = await Promise.all([
    supabase.from('location_activities').select('*').order('location_id').order('sort_order').order('name'),
    supabase.from('locations').select('id, name, display_name').order('sort_order').order('name'),
  ]);
  const locOptions = (locs ?? []).map((l) => ({ value: String(l.id), label: l.display_name || l.name }));
  const locLookup = Object.fromEntries(locOptions.map((o) => [o.value, o.label]));
  const rows = (acts ?? []).map((a) => ({
    ...a,
    location_id: String(a.location_id),
    fee: [a.entry_fee_adult != null && `Adult ₹${Number(a.entry_fee_adult).toLocaleString('en-IN')}`, a.entry_fee_child != null && `Child ₹${Number(a.entry_fee_child).toLocaleString('en-IN')}`, a.approx_cost_text].filter(Boolean).join(' · '),
    short: a.description ? (a.description.length > 110 ? a.description.slice(0, 110) + '…' : a.description) : '',
  }));

  const fields: FieldDef[] = [
    { name: 'location_id', label: 'Location', type: 'select', required: true, options: locOptions },
    { name: 'kind', label: 'Type', type: 'select', required: true, options: KINDS },
    { name: 'name', label: 'Name', type: 'text', required: true, span: 2, hint: 'Day plans refer to sightseeing by this exact name.' },
    { name: 'description', label: 'Description (shown on the quotation)', type: 'textarea' },
    { name: 'duration', label: 'Duration', type: 'text', placeholder: '2 hrs' },
    { name: 'timings', label: 'Timings', type: 'text', placeholder: '7:30 AM – 4:00 PM' },
    { name: 'closed_on', label: 'Closed on', type: 'text', placeholder: 'Mondays' },
    { name: 'entry_fee_adult', label: 'Entry fee – adult (₹)', type: 'number' },
    { name: 'entry_fee_child', label: 'Entry fee – child (₹)', type: 'number' },
    { name: 'approx_cost_text', label: 'Approx. cost text', type: 'text', placeholder: '₹3,800 (for 7 pax)' },
    { name: 'sort_order', label: 'Sort order', type: 'number', step: '1' },
    { name: 'is_optional_paid', label: 'List under "Optional activities (at additional cost)"', type: 'checkbox', span: 2 },
    { name: 'is_active', label: 'Active', type: 'checkbox' },
  ];
  const columns: ColumnDef[] = [
    { key: 'name', label: 'Name', sub: 'short', className: 'max-w-md' },
    { key: 'location_id', label: 'Location', format: 'lookup', lookup: locLookup },
    { key: 'kind', label: 'Type', format: 'badge', lookup: Object.fromEntries(KINDS.map((k) => [k.value, k.label])) },
    { key: 'fee', label: 'Fees / cost' },
    { key: 'is_optional_paid', label: 'Optional add-on', format: 'bool', align: 'center' },
    { key: 'is_active', label: 'Active', format: 'bool', align: 'center' },
  ];

  return (
    <EntityManager
      rows={rows}
      fields={fields}
      columns={columns}
      canEdit={canEditMasters(profile)}
      saveAction={saveActivity}
      deleteAction={deleteActivity}
      searchKeys={['name', 'description']}
      filters={[{ key: 'location_id', label: 'Locations', options: locOptions }, { key: 'kind', label: 'Types', options: KINDS }]}
      newLabel="Add sightseeing / activity"
      entityName="activity"
      defaults={{ kind: 'sightseeing', is_active: true, is_optional_paid: false, sort_order: 100 }}
    />
  );
}
