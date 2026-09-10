'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { TextField, TextAreaField, SelectField } from '@/components/ui/form-fields';
import { slugify } from '@/lib/validations/package';
import type { OfferFormValues } from '@/lib/validations/content';
import { createOffer, updateOffer } from '../content-actions';

export function OfferForm({
  offerId,
  initialValues,
  packages,
}: {
  offerId?: string;
  initialValues?: Partial<OfferFormValues>;
  packages: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [slugTouched, setSlugTouched] = useState(Boolean(offerId));
  const [values, setValues] = useState<Partial<OfferFormValues>>(initialValues ?? {});

  function set<K extends keyof OfferFormValues>(key: K, value: OfferFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = offerId ? await updateOffer(offerId, values) : await createOffer(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(offerId ? 'Offer updated' : 'Offer created as draft');
      if (!offerId && 'id' in result && result.id) {
        router.push(`/admin/offers/${result.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-5">
      <TextField
        label="Title"
        required
        value={values.title ?? ''}
        onChange={(e) => {
          set('title', e.target.value);
          if (!slugTouched) set('slug', slugify(e.target.value));
        }}
      />
      <TextField
        label="Slug"
        required
        value={values.slug ?? ''}
        onChange={(e) => {
          setSlugTouched(true);
          set('slug', e.target.value);
        }}
      />
      <TextAreaField
        label="Description"
        rows={3}
        value={values.description ?? ''}
        onChange={(e) => set('description', e.target.value)}
      />
      <SelectField
        label="Linked package (optional)"
        value={values.package_id ?? ''}
        onChange={(e) => set('package_id', e.target.value)}
      >
        <option value="">No specific package</option>
        {packages.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </SelectField>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Discount percent"
          type="number"
          min={0}
          max={100}
          value={values.discount_percent ?? ''}
          onChange={(e) => set('discount_percent', e.target.value ? Number(e.target.value) : null)}
        />
        <TextField
          label="Or flat discount amount"
          type="number"
          min={0}
          value={values.discount_flat ?? ''}
          onChange={(e) => set('discount_flat', e.target.value ? Number(e.target.value) : null)}
        />
        <TextField
          label="Valid from"
          type="date"
          required
          value={values.valid_from ?? ''}
          onChange={(e) => set('valid_from', e.target.value)}
        />
        <TextField
          label="Valid to"
          type="date"
          required
          value={values.valid_to ?? ''}
          onChange={(e) => set('valid_to', e.target.value)}
        />
        <TextField
          label="Image URL"
          value={values.image_url ?? ''}
          onChange={(e) => set('image_url', e.target.value)}
        />
      </div>
      <TextAreaField
        label="Terms"
        rows={3}
        value={values.terms ?? ''}
        onChange={(e) => set('terms', e.target.value)}
      />
      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'Saving…' : offerId ? 'Save changes' : 'Create offer'}
        </button>
      </div>
    </form>
  );
}
