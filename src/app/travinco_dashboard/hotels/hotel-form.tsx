'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { saveHotel } from './actions';

type Opt = { id: number; name: string };

const GROUPS: { title: string; fields: { name: string; label: string; type?: string; span?: boolean; area?: boolean; placeholder?: string }[] }[] = [
  {
    title: 'Contact',
    fields: [
      { name: 'contact_person', label: 'Contact person' },
      { name: 'phone', label: 'Phone', type: 'tel' },
      { name: 'alt_phone', label: 'Alternate phone', type: 'tel' },
      { name: 'whatsapp', label: 'WhatsApp', type: 'tel' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'reservation_email', label: 'Reservations email', type: 'email' },
      { name: 'website', label: 'Website', type: 'url', span: true },
    ],
  },
  {
    title: 'Address & stay',
    fields: [
      { name: 'address', label: 'Address', area: true },
      { name: 'google_maps_url', label: 'Google Maps link', type: 'url', span: true },
      { name: 'check_in_time', label: 'Check-in time', placeholder: '14:00' },
      { name: 'check_out_time', label: 'Check-out time', placeholder: '11:00' },
      { name: 'amenities', label: 'Amenities', area: true, placeholder: 'Pool, spa, restaurant, Wi-Fi…' },
    ],
  },
  {
    title: 'Billing',
    fields: [
      { name: 'gstin', label: 'GSTIN' },
      { name: 'gst_basis', label: 'GST on rates', placeholder: 'Included / Extra 12% / Not stated' },
      { name: 'payment_terms', label: 'Payment terms', area: true, placeholder: '50% advance, balance 7 days before check-in…' },
      { name: 'bank_details', label: 'Bank details', area: true },
      { name: 'notes', label: 'Internal notes', area: true },
    ],
  },
];

export function HotelForm({
  hotel,
  locations,
  categories,
  canEdit,
}: {
  hotel: Record<string, unknown> | null;
  locations: Opt[];
  categories: Opt[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [active, setActive] = useState(hotel ? !!hotel.is_active : true);
  const v = (k: string) => (hotel?.[k] == null ? '' : String(hotel[k]));

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data: Record<string, unknown> = Object.fromEntries(new FormData(e.currentTarget).entries());
    data.is_active = active;
    start(async () => {
      const res = await saveHotel(hotel ? Number(hotel.id) : null, data);
      if (res.error) return void toast.error(res.error);
      toast.success('Hotel saved');
      if (!hotel && res.id) router.push(`/admin/hotels/${res.id}`);
      else router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset disabled={!canEdit} className="space-y-5">
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-ink-900">Hotel</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="h-name">Hotel name <span className="text-red-500">*</span></label>
              <input id="h-name" name="name" required defaultValue={v('name')} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="h-loc">Location <span className="text-red-500">*</span></label>
              <select id="h-loc" name="location_id" required defaultValue={v('location_id')} className="input">
                <option value="">Select…</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="h-cat">Category</label>
              <select id="h-cat" name="default_category_id" defaultValue={v('default_category_id')} className="input">
                <option value="">—</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="h-area">Area</label>
              <input id="h-area" name="area" defaultValue={v('area')} className="input" placeholder="e.g. Chithirapuram" />
            </div>
            <label className="flex items-center gap-2 pt-7 text-sm text-ink-700">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-ink-300 text-brand-700" />
              Active (offered in quotations)
            </label>
          </div>
        </div>

        {GROUPS.map((g) => (
          <div key={g.title} className="card p-5">
            <h2 className="mb-4 font-semibold text-ink-900">{g.title}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {g.fields.map((f) => (
                <div key={f.name} className={f.span || f.area ? 'sm:col-span-2' : ''}>
                  <label className="label" htmlFor={`h-${f.name}`}>{f.label}</label>
                  {f.area ? (
                    <textarea id={`h-${f.name}`} name={f.name} rows={2} defaultValue={v(f.name)} placeholder={f.placeholder} className="input" />
                  ) : (
                    <input id={`h-${f.name}`} name={f.name} type={f.type ?? 'text'} defaultValue={v(f.name)} placeholder={f.placeholder} className="input" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
      {canEdit && (
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Saving…' : hotel ? 'Save changes' : 'Create hotel'}</button>
        </div>
      )}
    </form>
  );
}
