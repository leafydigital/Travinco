'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ComboInput } from '@/components/ui/combo-input';
import { cn } from '@/lib/utils/cn';
import { saveHotel } from './actions';

type Opt = { id: number; name: string };

/** Field widths are sized to the label / expected content so several fit on one row. */
const W = {
  xs: 'sm:w-28',
  sm: 'sm:w-40',
  md: 'sm:w-48',
  lg: 'sm:w-60',
  grow: 'sm:min-w-[16rem] sm:flex-1',
  area: 'sm:min-w-[18rem] sm:flex-1',
} as const;

type FieldDef = { name: string; label: string; type?: string; w: keyof typeof W; area?: boolean; placeholder?: string };

const GROUPS: { title: string; fields: FieldDef[] }[] = [
  {
    title: 'Contact',
    fields: [
      { name: 'contact_person', label: 'Contact person', w: 'md' },
      { name: 'phone', label: 'Phone', type: 'tel', w: 'sm' },
      { name: 'alt_phone', label: 'Alternate phone', type: 'tel', w: 'sm' },
      { name: 'whatsapp', label: 'WhatsApp', type: 'tel', w: 'sm' },
      { name: 'email', label: 'Email', type: 'email', w: 'lg' },
      { name: 'reservation_email', label: 'Reservations email', type: 'email', w: 'lg' },
      { name: 'website', label: 'Website', type: 'url', w: 'grow' },
    ],
  },
  {
    title: 'Address & stay',
    fields: [
      { name: 'check_in_time', label: 'Check-in', placeholder: '14:00', w: 'xs' },
      { name: 'check_out_time', label: 'Check-out', placeholder: '11:00', w: 'xs' },
      { name: 'google_maps_url', label: 'Google Maps link', type: 'url', w: 'grow' },
      { name: 'address', label: 'Address', area: true, w: 'area' },
      { name: 'amenities', label: 'Amenities', area: true, placeholder: 'Pool, spa, restaurant, Wi-Fi…', w: 'area' },
    ],
  },
  {
    title: 'Billing',
    fields: [
      { name: 'gstin', label: 'GSTIN', w: 'md' },
      { name: 'gst_basis', label: 'GST on rates', placeholder: 'Included / Extra 12% / Not stated', w: 'lg' },
      { name: 'payment_terms', label: 'Payment terms', area: true, placeholder: '50% advance, balance 7 days before check-in…', w: 'area' },
      { name: 'bank_details', label: 'Bank details', area: true, w: 'area' },
      { name: 'notes', label: 'Internal notes', area: true, w: 'area' },
    ],
  },
];

const labelCls = 'mb-1 block text-xs font-medium text-ink-600';
const inputCls = 'input h-8 py-1 text-sm';

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
  const [category, setCategory] = useState(
    () => categories.find((c) => String(c.id) === String(hotel?.default_category_id ?? ''))?.name ?? ''
  );
  const v = (k: string) => (hotel?.[k] == null ? '' : String(hotel[k]));

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data: Record<string, unknown> = Object.fromEntries(new FormData(e.currentTarget).entries());
    data.is_active = active;
    data.category_name = category;
    start(async () => {
      const res = await saveHotel(hotel ? Number(hotel.id) : null, data);
      if (res.error) return void toast.error(res.error);
      toast.success('Hotel saved');
      if (!hotel && res.id) router.push(`/travinco_dashboard/hotels/${res.id}`);
      else router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="card p-4">
      <fieldset disabled={!canEdit} className="space-y-4">
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Hotel</h2>
          <div className="flex flex-wrap items-end gap-x-3 gap-y-2.5">
            <div className={cn('w-full', W.grow)}>
              <label className={labelCls} htmlFor="h-name">Hotel name <span className="text-red-500">*</span></label>
              <input id="h-name" name="name" required defaultValue={v('name')} className={inputCls} />
            </div>
            <div className={cn('w-full', W.md)}>
              <label className={labelCls} htmlFor="h-loc">Location <span className="text-red-500">*</span></label>
              <select id="h-loc" name="location_id" required defaultValue={v('location_id')} className={inputCls}>
                <option value="">Select…</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className={cn('w-full', W.md)}>
              <label className={labelCls} htmlFor="h-cat">Category</label>
              <ComboInput
                id="h-cat"
                value={category}
                onChange={setCategory}
                options={categories.map((c) => c.name)}
                placeholder="Select or type"
                disabled={!canEdit}
                className="h-8 py-1 text-sm"
                emptyText="New category – it will be created on save"
              />
            </div>
            <div className={cn('w-full', W.md)}>
              <label className={labelCls} htmlFor="h-area">Area</label>
              <input id="h-area" name="area" defaultValue={v('area')} className={inputCls} placeholder="e.g. Chithirapuram" />
            </div>
            <label className="flex h-8 items-center gap-2 whitespace-nowrap text-sm text-ink-700">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-ink-300 text-brand-700" />
              Active (offered in quotations)
            </label>
          </div>
        </section>

        {GROUPS.map((g) => (
          <section key={g.title} className="border-t border-ink-100 pt-3">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">{g.title}</h2>
            <div className="flex flex-wrap items-start gap-x-3 gap-y-2.5">
              {g.fields.map((f) => (
                <div key={f.name} className={cn('w-full', W[f.w])}>
                  <label className={labelCls} htmlFor={`h-${f.name}`}>{f.label}</label>
                  {f.area ? (
                    <textarea id={`h-${f.name}`} name={f.name} rows={2} defaultValue={v(f.name)} placeholder={f.placeholder} className="input resize-y py-1 text-sm" />
                  ) : (
                    <input id={`h-${f.name}`} name={f.name} type={f.type ?? 'text'} defaultValue={v(f.name)} placeholder={f.placeholder} className={inputCls} />
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </fieldset>
      {canEdit && (
        <div className="mt-4 flex justify-end border-t border-ink-100 pt-3">
          <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Saving…' : hotel ? 'Save changes' : 'Create hotel'}</button>
        </div>
      )}
    </form>
  );
}
