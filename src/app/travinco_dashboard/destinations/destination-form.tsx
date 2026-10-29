'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { HField, CountryInput } from '@/components/admin/horizontal-field';
import { slugify } from '@/lib/validations/package';
import type { DestinationFormValues } from '@/lib/validations/settings';
import { createDestination, updateDestination, getFeaturedDestinations } from './actions';
import {
  FeaturedLimitDialog,
  MAX_FEATURED_DESTINATIONS,
  type FeaturedDestination,
} from './featured-limit-dialog';
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

  const [featured, setFeatured] = useState<FeaturedDestination[] | null>(null);
  const [showFeaturedLimit, setShowFeaturedLimit] = useState(false);

  useEffect(() => {
    getFeaturedDestinations()
      .then(setFeatured)
      .catch(() => setFeatured([]));
  }, []);

  const otherFeatured = (featured ?? []).filter((d) => d.id !== destinationId);

  async function handleFeaturedChange(checked: boolean) {
    if (!checked) {
      set('is_featured', false);
      return;
    }
    const list = featured ?? (await getFeaturedDestinations().catch(() => []));
    if (!featured) setFeatured(list);
    if (list.filter((d) => d.id !== destinationId).length >= MAX_FEATURED_DESTINATIONS) {
      setShowFeaturedLimit(true);
      return;
    }
    set('is_featured', true);
  }

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
        router.push(`/travinco_dashboard/destinations/${result.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3.5 p-5">
      <HField label="Name" required htmlFor="dest-name" fieldClassName="sm:max-w-md">
        <input
          id="dest-name"
          required
          className="input"
          value={values.name ?? ''}
          onChange={(e) => {
            set('name', e.target.value);
            if (!slugTouched) set('slug', slugify(e.target.value));
          }}
        />
      </HField>

      <HField label="Country" htmlFor="dest-country" fieldClassName="sm:max-w-xs">
        <CountryInput
          id="dest-country"
          value={values.country ?? ''}
          onChange={(v) => set('country', v)}
        />
      </HField>

      <HField label="Cover image">
        <div className="flex flex-wrap items-center gap-3">
          {values.cover_image_url && (
            <div className="h-16 w-24 overflow-hidden rounded-lg border border-ink-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={values.cover_image_url} alt="" className="h-full w-full object-cover" />
            </div>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleCoverImageSelect}
            disabled={isUploading}
            className="block text-sm text-ink-600 file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
          />
          {isUploading && <p className="text-xs text-brand-600">Uploading…</p>}
        </div>
      </HField>

      {!showSlugField ? (
        <div className="sm:pl-[8.75rem]">
          <button
            type="button"
            onClick={() => setShowSlugField(true)}
            className="text-xs text-brand-600 hover:underline"
          >
            Customize page URL
          </button>
        </div>
      ) : (
        <HField
          label="Slug (URL)"
          required
          htmlFor="dest-slug"
          fieldClassName="sm:max-w-md"
          hint="Used in the public URL, e.g. /destinations/munnar. Filled in automatically from the name — only change this if you specifically need a different URL."
        >
          <input
            id="dest-slug"
            required
            className="input"
            value={values.slug ?? ''}
            onChange={(e) => {
              setSlugTouched(true);
              set('slug', e.target.value);
            }}
          />
        </HField>
      )}

      <HField label="Description" htmlFor="dest-description">
        <textarea
          id="dest-description"
          rows={3}
          className="input"
          value={values.description ?? ''}
          onChange={(e) => set('description', e.target.value)}
        />
      </HField>

      <HField label="Featured">
        <label className="flex items-center gap-2 pt-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={values.is_featured ?? false}
            onChange={(e) => handleFeaturedChange(e.target.checked)}
            className="rounded border-ink-300"
          />
          Show in homepage &quot;Popular destinations&quot;
          <span className="text-xs text-ink-400">(max {MAX_FEATURED_DESTINATIONS})</span>
        </label>
      </HField>

      <HField label="Meta title" htmlFor="dest-meta-title" fieldClassName="sm:max-w-xl">
        <input
          id="dest-meta-title"
          className="input"
          value={values.meta_title ?? ''}
          onChange={(e) => set('meta_title', e.target.value)}
        />
      </HField>

      <HField label="Meta description" htmlFor="dest-meta-description">
        <textarea
          id="dest-meta-description"
          rows={2}
          className="input"
          value={values.meta_description ?? ''}
          onChange={(e) => set('meta_description', e.target.value)}
        />
      </HField>

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'Saving…' : destinationId ? 'Save changes' : 'Create destination'}
        </button>
      </div>

      <FeaturedLimitDialog
        open={showFeaturedLimit}
        featured={otherFeatured}
        onUnfeatured={(id) => {
          setFeatured((list) => (list ?? []).filter((d) => d.id !== id));
          set('is_featured', true);
          setShowFeaturedLimit(false);
        }}
        onClose={() => setShowFeaturedLimit(false)}
      />
    </form>
  );
}
