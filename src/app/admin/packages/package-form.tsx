'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { TextField, TextAreaField, SelectField } from '@/components/ui/form-fields';
import { StringListEditor } from '@/components/admin/string-list-editor';
import { packageCategories, slugify, type PackageFormValues } from '@/lib/validations/package';
import { createPackage, updatePackage } from './actions';

type Destination = { id: string; name: string };

export function PackageForm({
  destinations,
  initialValues,
  packageId,
}: {
  destinations: Destination[];
  initialValues?: Partial<PackageFormValues>;
  packageId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [slugTouched, setSlugTouched] = useState(Boolean(packageId));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [values, setValues] = useState<Partial<PackageFormValues>>({
    category: 'other',
    currency: 'INR',
    duration_days: 1,
    duration_nights: 0,
    base_price: 0,
    highlights: [],
    is_featured: false,
    ...initialValues,
  });

  function set<K extends keyof PackageFormValues>(key: K, value: PackageFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleTitleChange(title: string) {
    set('title', title);
    if (!slugTouched) {
      set('slug', slugify(title));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    startTransition(async () => {
      const result = packageId
        ? await updatePackage(packageId, values as PackageFormValues)
        : await createPackage(values as PackageFormValues);

      if (result.error) {
        toast.error(result.error);
        if (result.fieldErrors) setErrors(result.fieldErrors);
        return;
      }

      toast.success(packageId ? 'Package updated' : 'Package created as draft');
      if (!packageId && 'id' in result && result.id) {
        router.push(`/admin/packages/${result.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-ink-800">Basic information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Package title"
            required
            value={values.title ?? ''}
            onChange={(e) => handleTitleChange(e.target.value)}
          />
          <TextField
            label="Slug (URL)"
            required
            value={values.slug ?? ''}
            error={errors.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set('slug', e.target.value);
            }}
            hint="Used in the public URL, e.g. /packages/kerala-munnar-backwaters"
          />
          <SelectField
            label="Destination"
            required
            value={values.destination_id ?? ''}
            onChange={(e) => set('destination_id', e.target.value)}
          >
            <option value="">Select a destination…</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Category"
            value={values.category ?? 'other'}
            onChange={(e) => set('category', e.target.value as PackageFormValues['category'])}
          >
            {packageCategories.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Duration (days)"
            type="number"
            min={1}
            required
            value={values.duration_days ?? 1}
            onChange={(e) => set('duration_days', Number(e.target.value))}
          />
          <TextField
            label="Duration (nights)"
            type="number"
            min={0}
            required
            value={values.duration_nights ?? 0}
            onChange={(e) => set('duration_nights', Number(e.target.value))}
          />
        </div>
        <TextAreaField
          label="Short description"
          rows={2}
          value={values.short_description ?? ''}
          onChange={(e) => set('short_description', e.target.value)}
          hint="Shown on package cards — keep it under 500 characters."
        />
        <TextAreaField
          label="Full description"
          rows={6}
          value={values.full_description ?? ''}
          onChange={(e) => set('full_description', e.target.value)}
        />
      </div>

      <div className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-ink-800">Pricing & availability</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Starting price"
            type="number"
            min={0}
            required
            value={values.base_price ?? 0}
            onChange={(e) => set('base_price', Number(e.target.value))}
          />
          <TextField
            label="Discount price"
            type="number"
            min={0}
            error={errors.discount_price}
            value={values.discount_price ?? ''}
            onChange={(e) =>
              set('discount_price', e.target.value ? Number(e.target.value) : null)
            }
          />
          <TextField
            label="Currency"
            value={values.currency ?? 'INR'}
            onChange={(e) => set('currency', e.target.value.toUpperCase())}
          />
          <TextField
            label="Available from"
            type="date"
            value={values.available_from ?? ''}
            onChange={(e) => set('available_from', e.target.value || null)}
          />
          <TextField
            label="Available to"
            type="date"
            error={errors.available_to}
            value={values.available_to ?? ''}
            onChange={(e) => set('available_to', e.target.value || null)}
          />
          <TextField
            label="Total seats"
            type="number"
            min={1}
            value={values.total_seats ?? ''}
            onChange={(e) =>
              set('total_seats', e.target.value ? Number(e.target.value) : null)
            }
          />
        </div>
        <TextField
          label="Pickup information"
          value={values.pickup_info ?? ''}
          onChange={(e) => set('pickup_info', e.target.value)}
          placeholder="e.g. Pickup from Kochi Airport / Railway Station"
        />
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={values.is_featured ?? false}
            onChange={(e) => set('is_featured', e.target.checked)}
            className="rounded border-ink-300"
          />
          Feature this package on the homepage
        </label>
      </div>

      <div className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-ink-800">Highlights & terms</h2>
        <StringListEditor
          label="Highlights"
          items={values.highlights ?? []}
          onChange={(items) => set('highlights', items)}
          placeholder="e.g. Private houseboat stay in Alleppey"
        />
        <TextAreaField
          label="Terms and conditions"
          rows={4}
          value={values.terms_and_conditions ?? ''}
          onChange={(e) => set('terms_and_conditions', e.target.value)}
        />
      </div>

      <div className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-ink-800">SEO</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Meta title"
            value={values.meta_title ?? ''}
            onChange={(e) => set('meta_title', e.target.value)}
          />
          <TextField
            label="Meta description"
            value={values.meta_description ?? ''}
            onChange={(e) => set('meta_description', e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? 'Saving…' : packageId ? 'Save changes' : 'Create draft'}
        </button>
      </div>
    </form>
  );
}
