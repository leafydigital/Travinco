'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/admin-alert';
import { Plus, Trash2, Star, Loader2, Send, FileText } from 'lucide-react';
import { TextField, TextAreaField, SelectField, FieldWrapper } from '@/components/ui/form-fields';
import { StringListEditor } from '@/components/admin/string-list-editor';
import {
  packageCategories,
  packageSchema,
  slugify,
  validatePackageExtras,
  fieldErrorsFromZod,
  HIGHLIGHT_MAX_LENGTH,
  SHORT_DESCRIPTION_MAX_LENGTH,
  MAX_DURATION_DAYS,
  type PackageFormValues,
} from '@/lib/validations/package';
import { ConfirmDeleteDialog } from '@/components/admin/confirm-delete-dialog';
import { StagedImagePicker } from '@/components/admin/staged-image-picker';
import {
  AdminDateField,
  CurrencyCombobox,
  DestinationCombobox,
  FeaturedCheckingHint,
  FeaturedLimitModal,
  availabilityRange,
  blockNonNumericKeys,
  parseNonNegative,
  type DestinationValue,
  type FeaturedItem,
} from '@/components/admin/package-fields';
import { cn } from '@/lib/utils/cn';
import { createPackage, updatePackage, getFeaturedPackages } from './actions';
import { uploadPackageImage } from './upload-actions';

type Destination = { id: string; name: string };
type DraftItineraryDay = {
  day_number: number;
  title: string;
  description: string;
};

type NumberKey =
  'duration_days' | 'duration_nights' | 'base_price' | 'discount_price' | 'child_price' | 'total_seats';
/** Form state: number fields may be '' so they can be cleared while typing. */
type FormState = Omit<Partial<PackageFormValues>, NumberKey> & {
  [K in NumberKey]?: number | '' | null;
};

/** Stand-in id so a typed (not yet created) destination passes client-side validation. */
const PENDING_DESTINATION_ID = '00000000-0000-0000-0000-000000000000';

export function PackageForm({
  destinations,
  initialValues,
  packageId,
  currentStatus,
  header,
}: {
  /** Page heading shown in the sticky action bar (create form only). */
  header?: React.ReactNode;
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

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('package-form-saving', {
        detail: { isSaving: isPending },
      })
    );
  }, [isPending]);

  const [slugTouched, setSlugTouched] = useState(Boolean(packageId));
  const [showSeoFields, setShowSeoFields] = useState(Boolean(packageId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  // Cover image (one) and gallery images (many); saved as [cover, ...gallery]
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [pendingCover, setPendingCover] = useState(0);
  const [pendingGallery, setPendingGallery] = useState(0);
  const [videoUrlsText, setVideoUrlsText] = useState('');
  const [itineraryDays, setItineraryDays] = useState<DraftItineraryDay[]>([]);
  const [dayToDeleteIndex, setDayToDeleteIndex] = useState<number | null>(null);
  const [inclusionsList, setInclusionsList] = useState<string[]>([]);
  const [exclusionsList, setExclusionsList] = useState<string[]>([]);
  const [faqsList, setFaqsList] = useState<{ question: string; answer: string }[]>([]);
  const [faqToDeleteIndex, setFaqToDeleteIndex] = useState<number | null>(null);

  const [destination, setDestination] = useState<DestinationValue>(() => {
    const match = destinations.find((d) => d.id === initialValues?.destination_id);
    return match ? { id: match.id, name: match.name } : { id: null, name: '' };
  });

  // Featured slot handling (max 4 on the homepage)
  const wasFeatured = Boolean(packageId && initialValues?.is_featured);
  const [featuredModalItems, setFeaturedModalItems] = useState<FeaturedItem[] | null>(null);
  const [featuredMax, setFeaturedMax] = useState(4);
  const [replaceFeatured, setReplaceFeatured] = useState<FeaturedItem | null>(null);
  const [checkingFeatured, setCheckingFeatured] = useState(false);

  const [values, setValues] = useState<FormState>({
    category: 'other',
    currency: 'INR',
    duration_days: 1,
    duration_nights: 0,
    base_price: '',
    highlights: [],
    is_featured: false,
    ...initialValues,
  });

  const range = availabilityRange();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key as string]) {
      setErrors(({ [key as string]: _removed, ...rest }) => rest);
    }
  }

  function handleTitleChange(title: string) {
    set('title', title);
    if (!slugTouched) {
      set('slug', slugify(title));
    }
  }

  /** Props for a number input that can be cleared and never goes negative. */
  function numberInput(key: NumberKey, { integer = false }: { integer?: boolean } = {}) {
    return {
      type: 'number',
      min: 0,
      step: integer ? 1 : 'any',
      inputMode: integer ? ('numeric' as const) : ('decimal' as const),
      value: values[key] ?? '',
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => blockNonNumericKeys(e, !integer),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const parsed = parseNonNegative(e.target.value, integer);
        if (parsed !== null) set(key, parsed);
      },
    };
  }

  // Live check so the team sees the nights/days rule while typing
  const days = values.duration_days;
  const nights = values.duration_nights;
  const nightsError =
    typeof days === 'number' && typeof nights === 'number' && nights > days
      ? 'Nights must be less than or equal to days'
      : errors.duration_nights;

  async function handleFeaturedToggle(checked: boolean) {
    if (!checked) {
      set('is_featured', false);
      setReplaceFeatured(null);
      return;
    }
    if (wasFeatured) {
      set('is_featured', true);
      return;
    }
    setCheckingFeatured(true);
    const res = await getFeaturedPackages();
    setCheckingFeatured(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    const others = res.packages.filter((p) => p.id !== packageId);
    setFeaturedMax(res.max);
    if (others.length >= res.max) {
      setFeaturedModalItems(others.map((p) => ({ ...p, kind: 'existing' as const })));
      return;
    }
    set('is_featured', true);
  }

  /** Uploads staged photos once the admin clicks "Save photos". Returns the uploaded URLs and failed files. */
  async function uploadFiles(files: File[]) {
    const urls: string[] = [];
    const failed: File[] = [];
    const errorsList: string[] = [];
    for (const file of files) {
      const formData = new FormData();
      formData.set('file', file);
      const result = await uploadPackageImage(formData);
      if (result.error) {
        failed.push(file);
        errorsList.push(`${file.name}: ${result.error}`);
      } else if (result.url) {
        urls.push(result.url);
      }
    }
    if (errorsList.length > 0) toast.error(errorsList.join(' • '));
    return { urls, failed };
  }

  async function uploadCover(files: File[]) {
    const { urls, failed } = await uploadFiles(files.slice(0, 1));
    if (urls[0]) {
      setCoverUrl(urls[0]);
      toast.success('Cover image uploaded');
    }
    return failed;
  }

  async function uploadGallery(files: File[]) {
    const { urls, failed } = await uploadFiles(files);
    if (urls.length > 0) {
      setGalleryUrls((prev) => [...prev, ...urls]);
      toast.success(urls.length === 1 ? 'Gallery image uploaded' : `${urls.length} gallery images uploaded`);
    }
    return failed;
  }

  function addItineraryDay() {
    setItineraryDays((prev) => [...prev, { day_number: prev.length + 1, title: '', description: '' }]);
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

  /** Converts form state into the shape the server action validates. */
  function buildPayload(): PackageFormValues {
    const optional = (v: number | '' | null | undefined) => (v === '' || v === undefined ? null : v);
    return {
      ...values,
      destination_id: destination.id,
      duration_days: values.duration_days === '' ? undefined : values.duration_days,
      duration_nights: values.duration_nights === '' ? undefined : values.duration_nights,
      base_price: values.base_price === '' || values.base_price == null ? 0 : values.base_price,
      discount_price: optional(values.discount_price),
      child_price: optional(values.child_price),
      total_seats: optional(values.total_seats),
      available_from: values.available_from || null,
      available_to: values.available_to || null,
    } as PackageFormValues;
  }

  function handleSubmit(e: React.FormEvent, publishNow: boolean) {
    e.preventDefault();
    setSubmitted(true);

    if (pendingCover > 0 || pendingGallery > 0) {
      toast.warning('Photos not uploaded yet', {
        description: 'Click "Save photo(s)" to upload the selected images, or remove them, before saving the package.',
      });
      document
        .getElementById(pendingCover > 0 ? 'package-cover' : 'package-gallery')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const payload = buildPayload();
    const destinationName = destination.id ? null : destination.name.trim();

    // Client-side check with the same rules the server enforces
    const check = packageSchema.safeParse({
      ...payload,
      destination_id: payload.destination_id || (destinationName ? PENDING_DESTINATION_ID : null),
    });
    const fieldErrors = check.success ? {} : fieldErrorsFromZod(check.error);
    const extrasError = packageId
      ? null
      : validatePackageExtras({
          itineraryDays,
          inclusions: inclusionsList,
          exclusions: exclusionsList,
          faqs: faqsList,
        });
    if (Object.keys(fieldErrors).length > 0 || extrasError) {
      setErrors(fieldErrors);
      toast.error(
        extrasError && Object.keys(fieldErrors).length === 0
          ? extrasError
          : 'Please fix the highlighted fields.'
      );
      requestAnimationFrame(() => {
        document
          .querySelector('[aria-invalid="true"], .field-error')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }
    setErrors({});

    const options = {
      destinationName,
      replaceFeaturedId: values.is_featured ? (replaceFeatured?.id ?? null) : null,
    };

    startTransition(async () => {
      // The first image is the package cover (createPackage stores it as cover_image_url)
      const allImageUrls = coverUrl ? [coverUrl, ...galleryUrls] : galleryUrls;
      const videoUrls = videoUrlsText
        .split(/[\n,]/)
        .map((u) => u.trim())
        .filter(Boolean);

      const result = packageId
        ? await updatePackage(packageId, payload, options)
        : await createPackage(
            payload,
            allImageUrls,
            videoUrls,
            itineraryDays,
            inclusionsList,
            exclusionsList,
            faqsList,
            publishNow,
            options
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
        router.push(`/travinco_dashboard/packages/${result.id}/preview`);
      } else if (packageId) {
        // Editing an existing package: back to the admin packages
        // list, so staff land somewhere useful after saving rather
        // than staying on the same edit form.
        router.push('/travinco_dashboard/packages');
      } else {
        router.refresh();
      }
    });
  }

  const shortDescriptionLength = values.short_description?.length ?? 0;

  return (
    <form id="package-form" noValidate onSubmit={(e) => handleSubmit(e, false)} className="space-y-3">
      {!packageId && (
        <div className="sticky top-0 z-30 -mx-3.5 border-b border-ink-200 bg-ink-50/95 px-3.5 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">{header}</div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="submit" className="btn-outline inline-flex items-center gap-1.5" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {isPending ? 'Saving…' : 'Save as draft'}
              </button>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                className="btn-primary inline-flex items-center gap-1.5"
                disabled={isPending}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isPending ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Basic information */}
      <div className="card space-y-2.5 p-4">
        <h2 className="text-sm font-semibold text-ink-800">Basic information</h2>
        <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-12">
          <div className="sm:col-span-2 lg:col-span-4">
            <TextField
              label="Package title"
              required
              value={values.title ?? ''}
              error={errors.title}
              aria-invalid={Boolean(errors.title)}
              onChange={(e) => handleTitleChange(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <TextField
              label="Slug (URL)"
              required
              value={values.slug ?? ''}
              error={errors.slug}
              aria-invalid={Boolean(errors.slug)}
              onChange={(e) => {
                setSlugTouched(true);
                set('slug', e.target.value);
              }}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <FieldWrapper label="Destination" required error={errors.destination_id}>
              <DestinationCombobox
                destinations={destinations}
                value={destination}
                invalid={Boolean(errors.destination_id)}
                onChange={(next) => {
                  setDestination(next);
                  if (errors.destination_id) setErrors(({ destination_id: _d, ...rest }) => rest);
                }}
              />
            </FieldWrapper>
          </div>

          <div className="flex flex-wrap items-start gap-x-3 gap-y-2.5 sm:col-span-2 lg:col-span-12">
            <div className="w-40">
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
            </div>
            <div className="w-32">
              <TextField
                label="Duration (days)"
                required
                max={MAX_DURATION_DAYS}
                error={errors.duration_days}
                aria-invalid={Boolean(errors.duration_days)}
                {...numberInput('duration_days', { integer: true })}
              />
            </div>
            <div className="w-36">
              <TextField
                label="Duration (nights)"
                required
                error={nightsError}
                aria-invalid={Boolean(nightsError)}
                {...numberInput('duration_nights', { integer: true })}
              />
            </div>
            <div className="min-w-[16rem] flex-1">
              <TextField
                label="Pickup information"
                value={values.pickup_info ?? ''}
                onChange={(e) => set('pickup_info', e.target.value)}
                placeholder="e.g. Pickup from Kochi Airport / Railway Station"
              />
            </div>
          </div>

          <div className="sm:col-span-2 lg:col-span-5">
            <TextAreaField
              label={`Short description (${shortDescriptionLength}/${SHORT_DESCRIPTION_MAX_LENGTH})`}
              required
              rows={3}
              maxLength={SHORT_DESCRIPTION_MAX_LENGTH}
              value={values.short_description ?? ''}
              error={errors.short_description}
              aria-invalid={Boolean(errors.short_description)}
              onChange={(e) => set('short_description', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-7">
            <TextAreaField
              label="Overview"
              required
              rows={3}
              value={values.full_description ?? ''}
              error={errors.full_description}
              aria-invalid={Boolean(errors.full_description)}
              onChange={(e) => set('full_description', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Pricing & availability */}
      <div className="card space-y-2.5 p-4">
        <h2 className="text-sm font-semibold text-ink-800">Pricing & availability</h2>
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2.5">
          <div className="w-36">
            <TextField
              label="Starting price"
              required
              error={errors.base_price}
              aria-invalid={Boolean(errors.base_price)}
              {...numberInput('base_price')}
            />
          </div>
          <div className="w-36">
            <TextField
              label="Discount price"
              error={errors.discount_price}
              aria-invalid={Boolean(errors.discount_price)}
              {...numberInput('discount_price')}
            />
          </div>
          <div className="w-48">
            <TextField
              label="Children price (optional)"
              error={errors.child_price}
              aria-invalid={Boolean(errors.child_price)}
              {...numberInput('child_price')}
            />
          </div>
          <div className="w-56">
            <FieldWrapper label="Currency" required error={errors.currency}>
              <CurrencyCombobox
                value={values.currency ?? ''}
                invalid={Boolean(errors.currency)}
                onChange={(code) => set('currency', code)}
              />
            </FieldWrapper>
          </div>
          <div className="w-44">
            <FieldWrapper label="Available from" error={errors.available_from}>
              <AdminDateField
                value={values.available_from ?? ''}
                min={range.min}
                max={range.max}
                onChange={(iso) => {
                  set('available_from', iso || null);
                  if (iso && values.available_to && values.available_to < iso) set('available_to', null);
                }}
              />
            </FieldWrapper>
          </div>
          <div className="w-44">
            <FieldWrapper label="Available to" error={errors.available_to}>
              <AdminDateField
                value={values.available_to ?? ''}
                min={values.available_from || range.min}
                max={range.max}
                invalid={Boolean(errors.available_to)}
                onChange={(iso) => set('available_to', iso || null)}
              />
            </FieldWrapper>
          </div>
          <div className="w-28">
            <TextField
              label="Total seats"
              error={errors.total_seats}
              aria-invalid={Boolean(errors.total_seats)}
              {...numberInput('total_seats', { integer: true })}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={values.is_featured ?? false}
              disabled={checkingFeatured}
              onChange={(e) => handleFeaturedToggle(e.target.checked)}
              className="rounded border-ink-300"
            />
            Feature this package on the homepage
            {checkingFeatured && <FeaturedCheckingHint />}
          </label>
          {values.is_featured && replaceFeatured && (
            <p className="flex items-center gap-1.5 text-xs text-amber-700">
              <Star className="h-3.5 w-3.5" />“{replaceFeatured.title}” will be un-featured when you save.
              <button
                type="button"
                data-no-confirm-save="true"
                className="font-medium underline"
                onClick={() => {
                  setReplaceFeatured(null);
                  set('is_featured', false);
                }}
              >
                Undo
              </button>
            </p>
          )}
          {errors.is_featured && <p className="field-error">{errors.is_featured}</p>}
        </div>
      </div>

      {/* Highlights (+ inclusions/exclusions when creating) */}
      <div className="card space-y-2.5 p-4">
        <h2 className="text-sm font-semibold text-ink-800">
          {packageId ? 'Highlights' : 'Highlights, inclusions & exclusions'}
        </h2>
        <div className={cn('grid gap-x-5 gap-y-3', !packageId && 'lg:grid-cols-3')}>
          <StringListEditor
            label="Highlights"
            items={values.highlights ?? []}
            onChange={(items) => set('highlights', items)}
            placeholder="e.g. Private houseboat stay in Alleppey"
            maxLength={HIGHLIGHT_MAX_LENGTH}
            error={errors.highlights}
          />
          {!packageId && (
            <>
              <StringListEditor
                label="Inclusions"
                items={inclusionsList}
                onChange={setInclusionsList}
                placeholder="e.g. All meals included"
                maxLength={255}
              />
              <StringListEditor
                label="Exclusions"
                items={exclusionsList}
                onChange={setExclusionsList}
                placeholder="e.g. Airfare not included"
                maxLength={255}
              />
            </>
          )}
        </div>
        <p className="text-xs text-ink-400">
          Terms &amp; conditions are now managed once for all packages under{' '}
          <a href="/travinco_dashboard/settings" className="text-brand-600 hover:underline">
            Settings
          </a>
          , instead of being entered separately here.
        </p>
      </div>

      {!packageId && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="card space-y-2.5 p-4">
            <h2 className="text-sm font-semibold text-ink-800">
              Day-by-day itinerary{' '}
              <span className="font-normal text-xs text-ink-400">— optional; each day needs a title</span>
            </h2>
            {itineraryDays.map((day, i) => {
              const titleInvalid = submitted && !day.title.trim();
              return (
                <div key={i} className="rounded-xl2 border border-ink-100 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-brand-700">Day {day.day_number}</p>
                    <button
                      type="button"
                      data-no-confirm-save="true"
                      onClick={() => setDayToDeleteIndex(i)}
                      className="rounded-lg p-1.5 text-coral-500 hover:bg-coral-50 hover:text-coral-700 transition cursor-pointer"
                      aria-label="Remove day"
                      title="Remove this day"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <input
                    value={day.title}
                    onChange={(e) => updateItineraryDay(i, 'title', e.target.value)}
                    placeholder="e.g. Arrival & houseboat check-in"
                    maxLength={200}
                    aria-invalid={titleInvalid}
                    className={cn('input mt-1.5', titleInvalid && 'border-red-400')}
                  />
                  {titleInvalid && <p className="field-error">Day title is required</p>}
                  <textarea
                    value={day.description}
                    onChange={(e) => updateItineraryDay(i, 'description', e.target.value)}
                    placeholder="What happens this day (optional)"
                    rows={2}
                    className="input mt-1.5"
                  />
                </div>
              );
            })}
            <button type="button" onClick={addItineraryDay} className="btn-outline">
              <Plus className="h-4 w-4" /> Add a day
            </button>
          </div>

          <div className="card space-y-2.5 p-4">
            <h2 className="text-sm font-semibold text-ink-800">
              FAQs{' '}
              <span className="font-normal text-xs text-ink-400">
                — optional; each question needs an answer
              </span>
            </h2>
            {faqsList.map((faq, i) => {
              const questionInvalid = submitted && !faq.question.trim();
              const answerInvalid = submitted && !faq.answer.trim();
              return (
                <div key={i} className="rounded-xl2 border border-ink-100 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                      Question {i + 1}
                    </p>
                    <button
                      type="button"
                      data-no-confirm-save="true"
                      onClick={() => setFaqToDeleteIndex(i)}
                      className="rounded-lg p-1.5 text-coral-500 hover:bg-coral-50 hover:text-coral-700 transition cursor-pointer"
                      aria-label="Remove question"
                      title="Remove this question"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <input
                    value={faq.question}
                    onChange={(e) => updateFaq(i, 'question', e.target.value)}
                    placeholder="e.g. Is airport pickup included?"
                    maxLength={300}
                    aria-invalid={questionInvalid}
                    className={cn('input mt-1.5', questionInvalid && 'border-red-400')}
                  />
                  {questionInvalid && <p className="field-error">Question is required</p>}
                  <textarea
                    value={faq.answer}
                    onChange={(e) => updateFaq(i, 'answer', e.target.value)}
                    placeholder="Answer"
                    rows={2}
                    aria-invalid={answerInvalid}
                    className={cn('input mt-1.5', answerInvalid && 'border-red-400')}
                  />
                  {answerInvalid && <p className="field-error">Answer is required</p>}
                </div>
              );
            })}
            <button type="button" onClick={addFaq} className="btn-outline">
              <Plus className="h-4 w-4" /> Add a question
            </button>
          </div>
        </div>
      )}

      {!packageId && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div id="package-cover" className="card space-y-2.5 p-4">
            <h2 className="text-sm font-semibold text-ink-800">Cover image</h2>
            <p className="text-xs text-ink-400">
              JPG, PNG or WEBP — shown at the top of the package page and on package cards.{' '}
              <strong>An image is required to publish.</strong>
            </p>

            {coverUrl && (
              <div className="relative aspect-video w-full max-w-xs overflow-hidden rounded-lg border border-ink-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverUrl} alt="Cover" className="h-full w-full object-cover" />
                <button
                  type="button"
                  data-no-confirm-save="true"
                  onClick={() => setCoverUrl(null)}
                  className="absolute right-1 top-1 rounded-full bg-coral-600 p-1 text-white shadow"
                  aria-label="Remove cover image"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}

            <StagedImagePicker
              multiple={false}
              onSave={uploadCover}
              disabled={isPending}
              onPendingChange={setPendingCover}
            />
            {coverUrl && <p className="text-[11px] text-ink-400">Choosing a new photo replaces the current cover.</p>}
          </div>

          <div id="package-gallery" className="card space-y-2.5 p-4">
            <h2 className="text-sm font-semibold text-ink-800">Gallery images</h2>
            <p className="text-xs text-ink-400">JPG, PNG or WEBP — shown in the photo gallery on the package page.</p>

            {galleryUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {galleryUrls.map((url) => (
                  <div
                    key={url}
                    className="relative aspect-square overflow-hidden rounded-lg border border-ink-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      data-no-confirm-save="true"
                      onClick={() => setGalleryUrls((prev) => prev.filter((u) => u !== url))}
                      className="absolute right-1 top-1 rounded-full bg-coral-600 p-1 text-white shadow"
                      aria-label="Remove gallery image"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <StagedImagePicker onSave={uploadGallery} disabled={isPending} onPendingChange={setPendingGallery} />

            {!coverUrl && galleryUrls.length === 0 && (
              <p className="rounded-lg bg-sand-50 px-3 py-2 text-xs text-sand-800">
                No images saved yet — an image is needed before this package can be published. You can still save
                it as a draft now and add images later.
              </p>
            )}
          </div>

          <div className="card space-y-2.5 p-4">
            <h2 className="text-sm font-semibold text-ink-800">Video</h2>
            <textarea
              value={videoUrlsText}
              onChange={(e) => setVideoUrlsText(e.target.value)}
              placeholder={
                'https://www.youtube.com/watch?v=…\nhttps://vimeo.com/… (one per line, or comma-separated)'
              }
              rows={3}
              className="input w-full"
            />
            <p className="text-xs text-ink-400">
              YouTube or Vimeo links — they play inline on the package page.
            </p>
          </div>
        </div>
      )}

      <div className="card space-y-2.5 p-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-ink-800">SEO</h2>
          {!showSeoFields && (
            <button
              type="button"
              onClick={() => setShowSeoFields(true)}
              className="text-xs text-brand-600 hover:underline"
            >
              Customize SEO
            </button>
          )}
        </div>
        {showSeoFields && (
          <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
            <TextField
              label="Meta title (optional — auto-generated from the package title if left blank)"
              value={values.meta_title ?? ''}
              error={errors.meta_title}
              onChange={(e) => set('meta_title', e.target.value)}
            />
            <TextField
              label="Meta description (optional — auto-generated from the short description if left blank)"
              value={values.meta_description ?? ''}
              error={errors.meta_description}
              onChange={(e) => set('meta_description', e.target.value)}
            />
          </div>
        )}
      </div>

      <FeaturedLimitModal
        isOpen={featuredModalItems !== null}
        items={featuredModalItems ?? []}
        max={featuredMax}
        onClose={() => setFeaturedModalItems(null)}
        onRemove={(item) => {
          setReplaceFeatured(item);
          set('is_featured', true);
          setFeaturedModalItems(null);
        }}
      />

      {/* Itinerary Day Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={dayToDeleteIndex !== null}
        title="Remove Itinerary Day"
        description={
          dayToDeleteIndex !== null && itineraryDays[dayToDeleteIndex] ? (
            <div className="space-y-2 text-left">
              <p className="text-sm text-ink-700">
                Are you sure you want to remove{' '}
                <strong>Day {itineraryDays[dayToDeleteIndex].day_number}</strong>
                {itineraryDays[dayToDeleteIndex].title
                  ? `: "${itineraryDays[dayToDeleteIndex].title}"`
                  : ''}{' '}
                from this package itinerary?
              </p>
              <p className="text-xs text-ink-500">Subsequent days will automatically be renumbered.</p>
            </div>
          ) : (
            <p className="text-sm text-ink-700">
              Are you sure you want to remove this itinerary day? Subsequent days will automatically be
              renumbered.
            </p>
          )
        }
        confirmLabel="Remove Day"
        onConfirm={() => {
          if (dayToDeleteIndex !== null) {
            removeItineraryDay(dayToDeleteIndex);
            setDayToDeleteIndex(null);
            toast.success('Itinerary day removed');
          }
        }}
        onClose={() => setDayToDeleteIndex(null)}
      />

      {/* FAQ Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={faqToDeleteIndex !== null}
        title="Remove FAQ"
        description={
          faqToDeleteIndex !== null && faqsList[faqToDeleteIndex] ? (
            <div className="space-y-2 text-left">
              <p className="text-sm text-ink-700">Are you sure you want to remove this FAQ?</p>
              {faqsList[faqToDeleteIndex].question && (
                <p className="rounded-lg bg-ink-50 p-2.5 text-xs font-semibold text-ink-800">
                  &ldquo;{faqsList[faqToDeleteIndex].question}&rdquo;
                </p>
              )}
            </div>
          ) : null
        }
        confirmLabel="Remove FAQ"
        onConfirm={() => {
          if (faqToDeleteIndex !== null) {
            removeFaq(faqToDeleteIndex);
            setFaqToDeleteIndex(null);
            toast.success('FAQ removed');
          }
        }}
        onClose={() => setFaqToDeleteIndex(null)}
      />
    </form>
  );
}
