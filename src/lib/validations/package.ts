import { z } from 'zod';
import { imageUrlSchema } from './image-url';

export const packageCategories = [
  'honeymoon', 'family', 'adventure', 'group', 'luxury', 'budget', 'pilgrimage', 'other',
] as const;

/** Homepage shows at most this many featured packages. */
export const MAX_FEATURED_PACKAGES = 4;
/** Character limit for a single highlight line. */
export const HIGHLIGHT_MAX_LENGTH = 120;
export const SHORT_DESCRIPTION_MAX_LENGTH = 500;
export const MAX_DURATION_DAYS = 365;
/**
 * Tour duration rule: nights must equal the days or be one less
 * (e.g. 5 days / 4 nights or 5 days / 5 nights). Returns the error, or null.
 */
export function nightsRuleError(days: unknown, nights: unknown): string | null {
  if (typeof days !== 'number' || typeof nights !== 'number') return null;
  if (nights > days) return 'Nights must be less than or equal to days';
  if (nights < days - 1) return `Nights must be ${days - 1} or ${days} for a ${days}-day package`;
  return null;
}

/** New packages must start availability at least this many days from today. */
export const AVAILABILITY_LEAD_DAYS = 2;

/** Earliest date (YYYY-MM-DD, local time) a new package can be available from. */
export function earliestAvailabilityDate(now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() + AVAILABILITY_LEAD_DAYS);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Field errors for availability dates that fall inside the lead-time window. */
export function availabilityLeadErrors(
  data: { available_from?: string | null; available_to?: string | null },
  earliest = earliestAvailabilityDate()
): Record<string, string> {
  const message = `Choose a date at least ${AVAILABILITY_LEAD_DAYS} days from today`;
  const errors: Record<string, string> = {};
  if (data.available_from && data.available_from < earliest) errors.available_from = message;
  if (data.available_to && data.available_to < earliest) errors.available_to = message;
  return errors;
}

/**
 * 10+ digits in a row, allowing +, spaces, dashes, dots and brackets between them
 * (e.g. 9876543210, +91 98765 43210, (0484) 123-4567). Short numbers like
 * "5D/4N" or "2025-2026" don't match.
 */
const PHONE_NUMBER_PATTERN = /\+?(?:\d[\s\-().]*){10,}/;

const requiredText =(message: string) => z.string().trim().min(1, message);

/** Optional numeric amount: blank -> null, otherwise a non-negative number. */
const optionalAmount = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.coerce.number().min(0, 'Amount cannot be negative').nullable()
);

export const packageSchema = z
  .object({
    destination_id: z
      .string({ required_error: 'Destination is required', invalid_type_error: 'Destination is required' })
      .uuid('Destination is required'),
    title: z
      .string()
      .trim()
      .min(3, 'Title is too short')
      .max(200)
      .refine((v) => !PHONE_NUMBER_PATTERN.test(v), 'Phone numbers are not allowed in the package title'),
    slug: z
      .string()
      .min(3)
      .max(220)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only'),
    category: z.enum(packageCategories),
    duration_days: z.coerce
      .number({ invalid_type_error: 'Enter the number of days' })
      .int('Use whole days')
      .min(1, 'Must be at least 1 day')
      .max(MAX_DURATION_DAYS, `Must be ${MAX_DURATION_DAYS} days or fewer`),
    duration_nights: z.coerce
      .number({ invalid_type_error: 'Enter the number of nights' })
      .int('Use whole nights')
      .min(0, 'Nights cannot be negative'),
    base_price: z.coerce.number().min(0, 'Price cannot be negative'),
    discount_price: optionalAmount.optional(),
    child_price: optionalAmount.optional(),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code, e.g. INR')
      .default('INR'),
    short_description: requiredText('Short description is required').max(
      SHORT_DESCRIPTION_MAX_LENGTH,
      `Keep it under ${SHORT_DESCRIPTION_MAX_LENGTH} characters`
    ),
    full_description: requiredText('Overview is required'),
    highlights: z
      .array(
        z
          .string()
          .trim()
          .min(1, 'Highlights cannot be blank')
          .max(HIGHLIGHT_MAX_LENGTH, `Each highlight must be ${HIGHLIGHT_MAX_LENGTH} characters or fewer`)
      )
      .default([]),
    available_from: z.string().optional().nullable(),
    available_to: z.string().optional().nullable(),
    total_seats: z.preprocess(
      (v) => (v === '' || v === undefined ? null : v),
      z.coerce.number().int('Use a whole number').min(1, 'Must be at least 1 seat').nullable()
    ).optional(),
    pickup_info: z.string().optional().nullable(),
    cover_image_url: imageUrlSchema.optional().nullable(),
    video_url: z.string().url().optional().nullable().or(z.literal('')),
    is_featured: z.coerce.boolean().default(false),
    meta_title: z.string().max(160).optional().nullable(),
    meta_description: z.string().max(320).optional().nullable(),
  })
  .refine(
    (data) => !nightsRuleError(data.duration_days, data.duration_nights),
    (data) => ({
      message: nightsRuleError(data.duration_days, data.duration_nights) ?? '',
      path: ['duration_nights'],
    })
  )
  .refine(
    (data) => !data.discount_price || data.discount_price < data.base_price,
    { message: 'Discount price must be lower than the starting price', path: ['discount_price'] }
  )
  .refine(
    (data) =>
      !data.available_from ||
      !data.available_to ||
      data.available_to >= data.available_from,
    { message: 'End date must be after start date', path: ['available_to'] }
  );

export type PackageFormValues = z.infer<typeof packageSchema>;

export const itineraryDaySchema = z.object({
  day_number: z.coerce.number().int().min(1),
  title: z.string().trim().min(1, 'Day title is required').max(200),
  description: z.string().trim().optional().nullable(),
  hotel: z.string().max(200).optional().nullable(),
  meals: z.string().max(100).optional().nullable(),
  transport: z.string().max(200).optional().nullable(),
  activities: z.array(z.string()).default([]),
  image_url: imageUrlSchema.optional().nullable(),
});

export const inclusionExclusionSchema = z.object({
  item: z.string().trim().min(1, 'Cannot be empty').max(255),
});

export const faqItemSchema = z.object({
  question: z.string().trim().min(1, 'Question cannot be empty').max(300),
  answer: z.string().trim().min(1, 'Answer cannot be empty'),
});

/** Itinerary days, inclusions, exclusions and FAQs submitted with a new package. */
export type PackageExtras = {
  itineraryDays: { day_number: number; title: string; description?: string | null }[];
  inclusions: string[];
  exclusions: string[];
  faqs: { question: string; answer: string }[];
};

/**
 * These sections are optional, but any row that was added must contain real
 * text — whitespace-only entries are rejected rather than silently saved.
 * Returns a human readable error, or null when everything is valid.
 */
export function validatePackageExtras(extras: Partial<PackageExtras>): string | null {
  for (const [i, day] of (extras.itineraryDays ?? []).entries()) {
    const title = day?.title?.trim() ?? '';
    if (!title) return `Itinerary day ${i + 1} needs a title (or remove that day).`;
    if (title.length > 200) return `Itinerary day ${i + 1} title is too long (max 200 characters).`;
  }
  const lists: [string, string[] | undefined][] = [
    ['Inclusion', extras.inclusions],
    ['Exclusion', extras.exclusions],
  ];
  for (const [label, list] of lists) {
    for (const [i, entry] of (list ?? []).entries()) {
      const text = entry?.trim() ?? '';
      if (!text) return `${label} ${i + 1} is empty — enter text or remove it.`;
      if (text.length > 255) return `${label} ${i + 1} is too long (max 255 characters).`;
    }
  }
  for (const [i, faq] of (extras.faqs ?? []).entries()) {
    if (!faq?.question?.trim()) return `FAQ ${i + 1} needs a question (or remove it).`;
    if (!faq?.answer?.trim()) return `FAQ ${i + 1} needs an answer (or remove it).`;
  }
  return null;
}

/** Collects the first zod issue per top-level field. */
export function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !fieldErrors[field]) {
      fieldErrors[field] = field === 'highlights' && issue.path.length > 1
        ? `Highlight ${Number(issue.path[1]) + 1}: ${issue.message}`
        : issue.message;
    }
  }
  return fieldErrors;
}

/** Generates a URL-safe slug from a title. Falls back to a short random
 * suffix strategy is left to the caller (checking uniqueness) since this
 * function has no database access. */
export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
