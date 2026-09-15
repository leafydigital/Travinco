'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { TextField, TextAreaField } from '@/components/ui/form-fields';
import { slugify } from '@/lib/validations/package';
import type { DestinationFormValues } from '@/lib/validations/settings';
import { createDestination, updateDestination } from './actions';

export function DestinationForm({
  destinationId,
  initialValues,
}: {
  destinationId?: string;
  initialValues?: Partial<DestinationFormValues>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [slugTouched, setSlugTouched] = useState(Boolean(destinationId));
  const [values, setValues] = useState<Partial<DestinationFormValues>>({
    is_featured: false,
    ...initialValues,
  });

  function set<K extends keyof DestinationFormValues>(key: K, value: DestinationFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = destinationId
        ? await updateDestination(destinationId, values)
        : await createDestination(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(destinationId ? 'Destination updated' : 'Destination created as draft');
      if (!destinationId && 'id' in result && result.id) {
        router.push(`/admin/destinations/${result.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Name"
          required
          value={values.name ?? ''}
          onChange={(e) => {
            set('name', e.target.value);
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
        <TextField label="Country" value={values.country ?? ''} onChange={(e) => set('country', e.target.value)} />
        <TextField
          label="Cover image URL"
          value={values.cover_image_url ?? ''}
          onChange={(e) => set('cover_image_url', e.target.value)}
        />
      </div>
      <TextAreaField
        label="Description"
        rows={4}
        value={values.description ?? ''}
        onChange={(e) => set('description', e.target.value)}
      />
      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input
          type="checkbox"
          checked={values.is_featured ?? false}
          onChange={(e) => set('is_featured', e.target.checked)}
          className="rounded border-ink-300"
        />
        Show in homepage &quot;Popular destinations&quot;
      </label>
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
      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'Saving…' : destinationId ? 'Save changes' : 'Create destination'}
        </button>
      </div>
    </form>
  );
}
