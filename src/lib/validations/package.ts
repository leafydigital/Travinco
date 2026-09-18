import { z } from 'zod';

export const packageCategories = [
  'honeymoon', 'family', 'adventure', 'group', 'luxury', 'budget', 'pilgrimage', 'other',
] as const;

export const packageSchema = z
  .object({
    destination_id: z.string().uuid().optional().nullable(),
    title: z.string().min(3, 'Title is too short').max(200),
    slug: z
      .string()
      .min(3)
      .max(220)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only'),
    category: z.enum(packageCategories),
    duration_days: z.coerce.number().int().min(1, 'Must be at least 1 day'),
    duration_nights: z.coerce.number().int().min(0),
    base_price: z.coerce.number().min(0, 'Price cannot be negative'),
    discount_price: z.coerce.number().min(0).nullable().optional(),
    currency: z.string().length(3).default('INR'),
    short_description: z.string().max(500).optional().nullable(),
    full_description: z.string().optional().nullable(),
    highlights: z.array(z.string().min(1)).default([]),
    available_from: z.string().optional().nullable(),
    available_to: z.string().optional().nullable(),
    total_seats: z.coerce.number().int().min(1).optional().nullable(),
    pickup_info: z.string().optional().nullable(),
    cover_image_url: z.string().url().optional().nullable(),
    video_url: z.string().url().optional().nullable().or(z.literal('')),
    is_featured: z.coerce.boolean().default(false),
    meta_title: z.string().max(160).optional().nullable(),
    meta_description: z.string().max(320).optional().nullable(),
  })
  .refine(
    (data) => !data.discount_price || data.discount_price <= data.base_price,
    { message: 'Discount price must not exceed base price', path: ['discount_price'] }
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
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional().nullable(),
  hotel: z.string().max(200).optional().nullable(),
  meals: z.string().max(100).optional().nullable(),
  transport: z.string().max(200).optional().nullable(),
  activities: z.array(z.string()).default([]),
  image_url: z.string().url().optional().nullable(),
});

export const inclusionExclusionSchema = z.object({
  item: z.string().min(1, 'Cannot be empty').max(255),
});

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
