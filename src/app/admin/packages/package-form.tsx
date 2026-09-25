'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { TextField, TextAreaField, SelectField } from '@/components/ui/form-fields';
import { StringListEditor } from '@/components/admin/string-list-editor';
import { packageCategories, slugify, type PackageFormValues } from '@/lib/validations/package';
import { createPackage, updatePackage } from './actions';
import { uploadPackageImage } from './upload-actions';

type Destination = { id: string; name: string };
type DraftItineraryDay = { day_number: number; title: string; description: string };

export function PackageForm({
  destinations,
  initialValues,
  packageId,
  currentStatus,
}: {
  destinations: Destination[];
  initialValues?: Partial<PackageFormValues>;
  packageId?: string;
  /** The package's actual current status, from the edit page's own
   * fetch — separate from `values` (which this form doesn't track
   * status through), used only to decide where "Save changes"
   * redirects afterward. */
  currentStatus?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [slugTouched, setSlugTouched] = useState(Boolean(packageId));
  const [showSeoFields, setShowSeoFields] = useState(Boolean(packageId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [videoUrlsText, setVideoUrlsText] = useState('');
  const [itineraryDays, setItineraryDays] = useState<DraftItineraryDay[]>([]);
  const [inclusionsList, setInclusionsList] = useState<string[]>([]);
  const [exclusionsList, setExclusionsList] = useState<string[]>([]);
  const [faqsList, setFaqsList] = useState<{ question: string; answer: string }[]>([]);

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

  function addItineraryDay() {
    setItineraryDays((prev) => [
      ...prev,
      { day_number: prev.length + 1, title: '', description: '' },
    ]);
  }
  function updateItineraryDay(index: number, field: 'title' | 'description', value: string) {
    setItineraryDays((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)));
  }
  function removeItineraryDay(index: number) {
    setItineraryDays((prev) =>
      prev.filter((_, i) => i !== index).map((d, i) => ({ ...d, day_number: i + 1 }))
    );
  }

  function addFaq() {
    setFaqsList((prev) => [...prev, { question: '', answer: '' }]);
  }
  function updateFaq(index: number, field: 'question' | 'answer', value: string) {
    setFaqsList((prev) => prev.map((f, i) => (i === index ? { ...f, [field]: value } : f)));
  }
  function removeFaq(index: number) {
    setFaqsList((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent, publishNow: boolean) {
    e.preventDefault();
    setErrors({});

    startTransition(async () => {
      const allImageUrls = uploadedUrls;
      const videoUrls = videoUrlsText
        .split(/[\n,]/)
        .map((u) => u.trim())
        .filter(Boolean);
      const validDays = itineraryDays.filter((d) => d.title.trim());

      const result = packageId
        ? await updatePackage(packageId, values as PackageFormValues)
        : await createPackage(
            values as PackageFormValues,
            allImageUrls,
            videoUrls,
            validDays,
            inclusionsList,
            exclusionsList,
            faqsList,
            publishNow
          );

      if (result.error) {
        toast.error(result.error);
        if (result.fieldErrors) setErrors(result.fieldErrors);
        return;
      }

      toast.success(
        packageId ? 'Package updated' : publishNow ? 'Package published' : 'Package saved as draft'
      );
      if (!packageId && 'id' in result && result.id) {
        // Route by the real slug this package now has, not a
        // placeholder — the preview page itself is keyed by ID, but
        // this keeps the URL shown afterwards consistent with what the
        // package will actually use once published.
        router.push(`/admin/packages/${result.id}/preview`);
      } else if (packageId) {
        // Editing an existing package: back to the admin packages
        // list, so staff land somewhere useful after saving rather
        // than staying on the same edit form.
        router.push('/admin/packages');
      } else {
        router.refresh();
      }
    });
  }

  return (
    <form id="package-form" onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
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
          <TextField
            label="Slug (URL)"
            required
            value={values.slug ?? ''}
            error={errors.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set('slug', e.target.value);
            }}
            hint="Used in the public URL, e.g. /packages/kerala-munnar-backwaters. Filled in automatically from the title — edit if you need a different URL."
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
            value={values.base_price === 0 ? '' : values.base_price ?? ''}
            onChange={(e) => set('base_price', e.target.value === '' ? 0 : Number(e.target.value))}
            hint="Required to publish — a draft can be saved without it."
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
            label="Children price (optional)"
            type="number"
            min={0}
            value={values.child_price ?? ''}
            onChange={(e) => set('child_price', e.target.value ? Number(e.target.value) : null)}
            hint="Leave blank to not show a separate children fare on the package page."
          />
          <SelectField
            label="Currency"
            value={values.currency ?? 'INR'}
            onChange={(e) => set('currency', e.target.value)}
          >
            <option value="INR">INR — Indian Rupee</option>
            <option value="USD">USD — US Dollar</option>
            <option value="EUR">EUR — Euro</option>
            <option value="GBP">GBP — British Pound</option>
            <option value="AED">AED — UAE Dirham</option>
            <option value="SAR">SAR — Saudi Riyal</option>
            <option value="SGD">SGD — Singapore Dollar</option>
            <option value="AUD">AUD — Australian Dollar</option>
            <option value="CAD">CAD — Canadian Dollar</option>
            <option value="MYR">MYR — Malaysian Ringgit</option>
            <option value="LKR">LKR — Sri Lankan Rupee</option>
            <option value="NPR">NPR — Nepalese Rupee</option>
            <option value="THB">THB — Thai Baht</option>
            <option value="JPY">JPY — Japanese Yen</option>
            <option value="CNY">CNY — Chinese Yuan</option>
          </SelectField>
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

      {!packageId && (
        <div className="card space-y-4 p-5">
          <h2 className="text-sm font-semibold text-ink-800">Day-by-day itinerary</h2>
          <p className="text-xs text-ink-400">Optional, but helps customers picture the trip.</p>
          {itineraryDays.map((day, i) => (
            <div key={i} className="rounded-xl2 border border-ink-100 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-brand-700">Day {day.day_number}</p>
                <button
                  type="button"
                  onClick={() => removeItineraryDay(i)}
                  className="text-coral-500 hover:text-coral-700"
                  aria-label="Remove day"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <input
                value={day.title}
                onChange={(e) => updateItineraryDay(i, 'title', e.target.value)}
                placeholder="e.g. Arrival & houseboat check-in"
                className="input mt-2"
              />
              <textarea
                value={day.description}
                onChange={(e) => updateItineraryDay(i, 'description', e.target.value)}
                placeholder="What happens this day (optional)"
                rows={2}
                className="input mt-2"
              />
            </div>
          ))}
          <button type="button" onClick={addItineraryDay} className="btn-outline">
            <Plus className="h-4 w-4" /> Add a day
          </button>
        </div>
      )}

      {!packageId && (
        <div className="card space-y-4 p-5">
          <h2 className="text-sm font-semibold text-ink-800">Inclusions & exclusions</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <StringListEditor
              label="Inclusions"
              items={inclusionsList}
              onChange={setInclusionsList}
              placeholder="e.g. All meals included"
            />
            <StringListEditor
              label="Exclusions"
              items={exclusionsList}
              onChange={setExclusionsList}
              placeholder="e.g. Airfare not included"
            />
          </div>
        </div>
      )}

      {!packageId && (
        <div className="card space-y-4 p-5">
          <h2 className="text-sm font-semibold text-ink-800">FAQs</h2>
          <p className="text-xs text-ink-400">Optional — answer the questions customers ask most.</p>
          {faqsList.map((faq, i) => (
            <div key={i} className="rounded-xl2 border border-ink-100 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                  Question {i + 1}
                </p>
                <button
                  type="button"
                  onClick={() => removeFaq(i)}
                  className="text-coral-500 hover:text-coral-700"
                  aria-label="Remove question"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <input
                value={faq.question}
                onChange={(e) => updateFaq(i, 'question', e.target.value)}
                placeholder="e.g. Is airport pickup included?"
                className="input mt-2"
              />
              <textarea
                value={faq.answer}
                onChange={(e) => updateFaq(i, 'answer', e.target.value)}
                placeholder="Answer"
                rows={2}
                className="input mt-2"
              />
            </div>
          ))}
          <button type="button" onClick={addFaq} className="btn-outline">
            <Plus className="h-4 w-4" /> Add a question
          </button>
        </div>
      )}

      {!packageId && (
        <div className="card space-y-4 p-5">
          <h2 className="text-sm font-semibold text-ink-800">Video</h2>
          <textarea
            value={videoUrlsText}
            onChange={(e) => setVideoUrlsText(e.target.value)}
            placeholder={'https://www.youtube.com/watch?v=…\nhttps://vimeo.com/… (one per line, or comma-separated)'}
            rows={3}
            className="input w-full"
          />
          <p className="text-xs text-ink-400">
            Paste as many YouTube or Vimeo links as you like — they play inline on the package
            page, the visitor never leaves the site.
          </p>
        </div>
      )}

      {!packageId && (
        <div className="card space-y-3 p-5">
          <h2 className="text-sm font-semibold text-ink-800">Photos</h2>
          <p className="text-xs text-ink-400">
            Upload JPG, PNG or WEBP photos directly — select multiple files at once to add
            several together. The first photo becomes the cover automatically.{' '}
            <strong>At least one photo is required to publish</strong> — a draft can be saved
            without one.
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

      {!packageId && (
        <div className="space-y-2">
          {uploadedUrls.length === 0 && (
            <p className="rounded-lg bg-sand-50 px-3 py-2 text-xs text-sand-800">
              No photos added yet — at least one image is needed before this package can be
              published. You can still save it as a draft now and add photos later.
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button type="submit" className="btn-outline" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save as draft'}
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              className="btn-primary"
              disabled={isPending}
            >
              {isPending ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
