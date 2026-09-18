'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { TextField, TextAreaField } from '@/components/ui/form-fields';
import { slugify } from '@/lib/validations/package';
import type { DestinationFormValues } from '@/lib/validations/settings';
import { createDestination, updateDestination } from './actions';
import { uploadDestinationImage } from './upload-actions';

export function DestinationForm({
  destinationId,
  initialValues,
}: {
  destinationId?: string;
  initialValues?: Partial<DestinationFormValues>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [slugTouched, setSlugTouched] = useState(Boolean(destinationId));
  const [showSlugField, setShowSlugField] = useState(Boolean(destinationId));
  const [values, setValues] = useState<Partial<DestinationFormValues>>({
    is_featured: false,
    ...initialValues,
  });

  function set<K extends keyof DestinationFormValues>(key: K, value: DestinationFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleCoverImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.set('file', file);
    const result = await uploadDestinationImage(formData);
    if (result.error) {
      toast.error(result.error);
    } else if (result.url) {
      set('cover_image_url', result.url);
      toast.success('Cover image uploaded');
    }
    setIsUploading(false);
    e.target.value = '';
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
        <TextField label="Country" value={values.country ?? ''} onChange={(e) => set('country', e.target.value)} />
      </div>

      <div>
        <label className="label">Cover image</label>
        {values.cover_image_url && (
          <div className="mb-2 h-32 w-full max-w-xs overflow-hidden rounded-lg border border-ink-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={values.cover_image_url} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleCoverImageSelect}
          disabled={isUploading}
          className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
        />
        {isUploading && <p className="mt-1.5 text-xs text-brand-600">Uploading…</p>}
      </div>

      <div>
        {!showSlugField ? (
          <button
            type="button"
            onClick={() => setShowSlugField(true)}
            className="text-xs text-brand-600 hover:underline"
          >
            Customize page URL
          </button>
        ) : (
          <TextField
            label="Slug (URL)"
            required
            value={values.slug ?? ''}
            onChange={(e) => {
              setSlugTouched(true);
              set('slug', e.target.value);
            }}
            hint="Used in the public URL, e.g. /destinations/munnar. Filled in automatically from the name — only change this if you specifically need a different URL."
          />
        )}
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
