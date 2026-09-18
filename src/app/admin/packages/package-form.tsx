'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { TextField, TextAreaField, SelectField } from '@/components/ui/form-fields';
import { StringListEditor } from '@/components/admin/string-list-editor';
import { packageCategories, slugify, type PackageFormValues } from '@/lib/validations/package';
import { createPackage, updatePackage } from './actions';
import { uploadPackageImage } from './upload-actions';

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
  const [showSlugField, setShowSlugField] = useState(Boolean(packageId));
  const [showSeoFields, setShowSeoFields] = useState(Boolean(packageId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imageUrlsText, setImageUrlsText] = useState('');
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

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

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setIsUploading(true);
    const newUrls: string[] = [];
    for (const file of files) {
      const formData = new FormData();
      formData.set('file', file);
      const result = await uploadPackageImage(formData);
      if (result.error) {
        toast.error(`${file.name}: ${result.error}`);
      } else if (result.url) {
        newUrls.push(result.url);
      }
    }
    if (newUrls.length > 0) {
      setUploadedUrls((prev) => [...prev, ...newUrls]);
      toast.success(newUrls.length === 1 ? 'Image uploaded' : `${newUrls.length} images uploaded`);
    }
    setIsUploading(false);
    e.target.value = '';
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    startTransition(async () => {
      const pastedUrls = imageUrlsText
        .split(/[\n,]/)
        .map((u) => u.trim())
        .filter(Boolean);
      const allImageUrls = [...uploadedUrls, ...pastedUrls];

      const result = packageId
        ? await updatePackage(packageId, values as PackageFormValues)
        : await createPackage(values as PackageFormValues, allImageUrls);

      if (result.error) {
        toast.error(result.error);
        if (result.fieldErrors) setErrors(result.fieldErrors);
        return;
      }

      toast.success(packageId ? 'Package updated' : 'Package created as draft');
      if (!packageId && 'id' in result && result.id) {
        router.push(`/admin/packages/${result.id}/preview`);
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
            error={errors.title}
            onChange={(e) => handleTitleChange(e.target.value)}
          />
          <SelectField
            label="Destination (optional)"
            value={values.destination_id ?? ''}
            error={errors.destination_id}
            onChange={(e) => set('destination_id', e.target.value || null)}
          >
            <option value="">No specific destination</option>
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
            value={values.duration_days ?? ''}
            error={errors.duration_days}
            onChange={(e) => set('duration_days', e.target.value === '' ? 1 : Number(e.target.value))}
          />
          <TextField
            label="Duration (nights)"
            type="number"
            min={0}
            required
            value={values.duration_nights === 0 ? '' : values.duration_nights ?? ''}
            error={errors.duration_nights}
            onChange={(e) => set('duration_nights', e.target.value === '' ? 0 : Number(e.target.value))}
          />
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
              error={errors.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set('slug', e.target.value);
              }}
              hint="Used in the public URL, e.g. /packages/kerala-munnar-backwaters. Filled in automatically from the title — only change this if you specifically need a different URL."
            />
          )}
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
            value={values.base_price === 0 ? '' : values.base_price ?? ''}
            onChange={(e) => set('base_price', e.target.value === '' ? 0 : Number(e.target.value))}
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
        <h2 className="text-sm font-semibold text-ink-800">Highlights</h2>
        <StringListEditor
          label="Highlights"
          items={values.highlights ?? []}
          onChange={(items) => set('highlights', items)}
          placeholder="e.g. Private houseboat stay in Alleppey"
        />
        <p className="text-xs text-ink-400">
          Terms &amp; conditions are now managed once for all packages under{' '}
          <a href="/admin/settings" className="text-brand-600 hover:underline">
            Settings
          </a>
          , instead of being entered separately here.
        </p>
      </div>

      <div className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-ink-800">Video</h2>
        <TextField
          label="Video URL (YouTube or Vimeo)"
          placeholder="https://www.youtube.com/watch?v=..."
          value={values.video_url ?? ''}
          onChange={(e) => set('video_url', e.target.value)}
        />
        <p className="text-xs text-ink-400">
          Paste a normal YouTube or Vimeo link — it plays inline on the package page, the
          visitor never leaves the site.
        </p>
      </div>

      {!packageId && (
        <div className="card space-y-3 p-5">
          <h2 className="text-sm font-semibold text-ink-800">Photos</h2>
          <p className="text-xs text-ink-400">
            Upload JPG, PNG or WEBP files directly, and/or paste image URLs below — one per
            line, or comma-separated. There&apos;s no limit on how many. The first photo becomes
            the cover automatically; you can change that, reorder, or add more later once the
            package is saved.
          </p>

          <div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFileSelect}
              disabled={isUploading}
              className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            />
            {isUploading && <p className="mt-1.5 text-xs text-brand-600">Uploading…</p>}
          </div>

          {uploadedUrls.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {uploadedUrls.map((url) => (
                <div key={url} className="relative aspect-square overflow-hidden rounded-lg border border-ink-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}

          <textarea
            value={imageUrlsText}
            onChange={(e) => setImageUrlsText(e.target.value)}
            placeholder={'https://…\nhttps://… (one per line, or comma-separated)'}
            rows={3}
            className="input w-full"
          />
        </div>
      )}

      <div className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-ink-800">SEO</h2>
        {!showSeoFields ? (
          <button
            type="button"
            onClick={() => setShowSeoFields(true)}
            className="text-xs text-brand-600 hover:underline"
          >
            Customize SEO
          </button>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Meta title (optional — auto-generated from the package title if left blank)"
              value={values.meta_title ?? ''}
              onChange={(e) => set('meta_title', e.target.value)}
            />
            <TextField
              label="Meta description (optional — auto-generated from the short description if left blank)"
              value={values.meta_description ?? ''}
              onChange={(e) => set('meta_description', e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? 'Saving…' : packageId ? 'Save changes' : 'Create draft'}
        </button>
      </div>
    </form>
  );
}
