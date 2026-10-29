'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/admin-alert';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
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
  // Inline status shown to the right of the file picker
  const [uploadStatus, setUploadStatus] = useState<{ ok: boolean; text: string } | null>(null);
  // Slug is generated from the name for new destinations; an existing one keeps its URL
  const slugLocked = Boolean(destinationId);
  const [values, setValues] = useState<Partial<DestinationFormValues>>({
    is_featured: false,
    ...initialValues,
  });

  const [countryError, setCountryError] = useState<string | null>(null);
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
    e.target.value = '';
    if (!file) return;
    setIsUploading(true);
    setUploadStatus(null);
    const formData = new FormData();
    formData.set('file', file);
    const result = await uploadDestinationImage(formData);
    setIsUploading(false);
    if (result.error || !result.url) {
      setUploadStatus({ ok: false, text: result.error || 'Upload failed. Please try again.' });
      return;
    }
    set('cover_image_url', result.url);
    setUploadStatus({ ok: true, text: 'Image uploaded successfully' });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isUploading) {
      toast.warning('Please wait for the cover image to finish uploading.');
      return;
    }
    if (!values.name?.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!values.country?.trim()) {
      setCountryError('Country is required');
      toast.error('Country is required');
      document.getElementById('dest-country')?.focus();
      return;
    }
    startTransition(async () => {
      const result = destinationId
        ? await updateDestination(destinationId, values)
        : await createDestination(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      // Navigate only after the save has fully finished and the user has read the
      // popup — so "Saving…" ends with the save, not after the page change.
      void toast
        .success(destinationId ? 'Destination updated successfully' : 'Destination created successfully', {
          description: destinationId
            ? 'Your changes have been saved.'
            : `"${values.name?.trim()}" is now published and visible on the website.`,
          persistent: true,
        })
        .then(() => {
          if (!destinationId) router.push('/travinco_dashboard/destinations');
          router.refresh();
        });
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
            if (!slugLocked) set('slug', slugify(e.target.value));
          }}
        />
      </HField>

      <HField label="Country" required htmlFor="dest-country" fieldClassName="sm:max-w-xs" error={countryError ?? undefined}>
        <CountryInput
          id="dest-country"
          required
          invalid={Boolean(countryError)}
          value={values.country ?? ''}
          onChange={(v) => {
            set('country', v);
            if (v.trim()) setCountryError(null);
          }}
        />
      </HField>

      <HField label="Cover image">
        <div className="flex flex-wrap items-center gap-3">
          {values.cover_image_url ? (
            // Uploaded image: thumbnail with a remove (X) button
            <div className="relative h-16 w-24 overflow-hidden rounded-lg border border-ink-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={values.cover_image_url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                data-no-confirm-save="true"
                onClick={() => {
                  set('cover_image_url', '');
                  setUploadStatus(null);
                }}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-coral-600 text-white shadow hover:bg-coral-700"
                aria-label="Remove cover image"
                title="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            // No image yet: show the file chooser
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleCoverImageSelect}
              disabled={isUploading}
              className="block text-sm text-ink-600 file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            />
          )}
          {isUploading && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
            </span>
          )}
          {!isUploading && uploadStatus && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                uploadStatus.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-coral-50 text-coral-700'
              }`}
            >
              {uploadStatus.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              {uploadStatus.text}
            </span>
          )}
        </div>
      </HField>

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
