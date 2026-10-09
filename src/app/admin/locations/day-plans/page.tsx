import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { canEditMasters } from '@/lib/tour/access';
import { EntityManager, type FieldDef, type ColumnDef } from '@/components/admin/entity-manager';
import { saveDayPlan, deleteDayPlan } from '@/lib/tour/master-actions';
import type { PlanItem } from '@/lib/tour/types';

export const metadata: Metadata = { title: 'Day plans — Admin Portal' };

const TYPES = [
  { value: 'arrival', label: 'Arrival day (lands in the stay town)' },
  { value: 'transfer', label: 'Travel day (from → to)' },
  { value: 'stay', label: 'Extra day in a town' },
  { value: 'departure', label: 'Departure day (last town → drop)' },
];
const SHORT: Record<string, string> = { arrival: 'Arrival', transfer: 'Travel', stay: 'Stay', departure: 'Departure' };

const itemsToText = (items: PlanItem[]) =>
  items.map((it) => (it.kind === 'sight' ? `* ${it.name}${it.desc ? ' | ' + it.desc : ''}` : it.text)).join('\n');

export default async function DayPlansPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ data: plans }, { data: locs }] = await Promise.all([
    supabase.from('day_plans').select('*').order('sort_order').order('id'),
    supabase.from('locations').select('id, name, display_name').order('sort_order').order('name'),
  ]);
  const name = (id: number | null) => {
    if (id == null) return '';
    const l = (locs ?? []).find((x) => x.id === id);
    return l ? l.display_name || l.name : `#${id}`;
  };
  const locOptions = (locs ?? []).map((l) => ({ value: String(l.id), label: l.display_name || l.name }));
  const rows = (plans ?? []).map((p) => ({
    ...p,
    from_location_id: p.from_location_id == null ? null : String(p.from_location_id),
    to_location_id: String(p.to_location_id),
    route:
      p.plan_type === 'arrival' ? `Arrive ${name(p.to_location_id)}`
      : p.plan_type === 'stay' ? `In ${name(p.to_location_id)}`
      : `${name(p.from_location_id)} → ${name(p.to_location_id)}`,
    type_label: SHORT[p.plan_type],
    items_text: itemsToText(Array.isArray(p.items) ? p.items : []),
    stops: (Array.isArray(p.items) ? (p.items as PlanItem[]) : []).filter((i) => i.kind === 'sight').length,
  }));

  const fields: FieldDef[] = [
    { name: 'plan_type', label: 'Day type', type: 'select', required: true, options: TYPES, span: 2 },
    { name: 'from_location_id', label: 'From', type: 'select', options: locOptions, showIf: { field: 'plan_type', values: ['transfer', 'departure'] } },
    { name: 'to_location_id', label: 'To / town', type: 'select', required: true, options: locOptions, hint: 'For departure days: the drop town.' },
    { name: 'label', label: 'Variant name', type: 'text', required: true, placeholder: 'Spices, Periyar cruise & Kathakali', hint: 'Shown in the quotation day picker.' },
    { name: 'title', label: 'Day title on the quotation', type: 'text', required: true, placeholder: 'Munnar → Thekkady' },
    { name: 'first_day_title', label: 'Title when this is Day 1', type: 'text', span: 2, showIf: { field: 'plan_type', values: ['transfer'] }, placeholder: 'Arrival in Cochin – Transfer to Munnar' },
    {
      name: 'items_text', label: 'Day lines', type: 'textarea', rows: 10,
      hint: 'One line each. Start a line with * for a sightseeing stop: "* Mattupetty Dam" (description comes from Sightseeing & activities) or "* Mattupetty Dam | your own description".',
    },
    { name: 'tip', label: 'Travinco tip / hidden gem', type: 'textarea', rows: 2 },
    { name: 'source', label: 'Source', type: 'text', placeholder: 'Which itinerary it came from' },
    { name: 'sort_order', label: 'Sort order', type: 'number', step: '1' },
    { name: 'no_opener', label: 'Skip the automatic first line (breakfast / arrival)', type: 'checkbox', span: 2 },
    { name: 'is_active', label: 'Active', type: 'checkbox' },
  ];
  const columns: ColumnDef[] = [
    { key: 'route', label: 'Route', sub: 'type_label' },
    { key: 'label', label: 'Variant', sub: 'title' },
    { key: 'stops', label: 'Stops', align: 'right' },
    { key: 'is_active', label: 'Active', format: 'bool', align: 'center' },
  ];

  return (
    <EntityManager
      rows={rows}
      fields={fields}
      columns={columns}
      canEdit={canEditMasters(profile)}
      saveAction={saveDayPlan}
      deleteAction={deleteDayPlan}
      searchKeys={['route', 'label', 'title', 'items_text']}
      filters={[
        { key: 'plan_type', label: 'Day types', options: TYPES.map((t) => ({ value: t.value, label: SHORT[t.value] })) },
        { key: 'to_location_id', label: 'Towns', options: locOptions },
      ]}
      newLabel="Add day plan"
      entityName="day plan"
      defaults={{ plan_type: 'transfer', is_active: true, no_opener: false, sort_order: 100 }}
    />
  );
}
