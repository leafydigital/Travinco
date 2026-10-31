import { z } from 'zod';
import { imageUrlSchema } from './image-url';
import { isValidLink } from './links';
import { isNumbersOnlyText, lettersRequiredMessage } from './text';

export const eventSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title is required (at least 3 characters)')
    .max(200)
    .refine((v) => !isNumbersOnlyText(v), lettersRequiredMessage('Title')),
  slug: z
    .string()
    .min(3)
    .max(220)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens only'),
  description: z.string().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  event_date: z.string().optional().nullable(),
  image_url: imageUrlSchema.optional().nullable().or(z.literal('')),
  cta_label: z.string().max(60).optional().nullable(),
  cta_url: z
    .string()
    .trim()
    .refine((v) => !v || isValidLink(v), 'Button link must be a page path like /packages or a full link starting with https://')
    .optional()
    .nullable(),
}).refine((d) => !d.cta_label?.trim() || d.cta_url?.trim(), {
  message: 'Add a button link for the button label',
  path: ['cta_url'],
});

export type EventFormValues = z.infer<typeof eventSchema>;

export const blogPostSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title is required (at least 3 characters)')
    .max(200)
    .refine((v) => !isNumbersOnlyText(v), lettersRequiredMessage('Title')),
  slug: z
    .string()
    .min(3)
    .max(220)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens only'),
  excerpt: z.string().max(500).optional().nullable(),
  content: z.string().optional().nullable(),
  cover_image_url: imageUrlSchema.optional().nullable().or(z.literal('')),
});

export type BlogPostFormValues = z.infer<typeof blogPostSchema>;

export const offerSchema = z
  .object({
    title: z
    .string()
    .trim()
    .min(3, 'Title is required (at least 3 characters)')
    .max(200)
    .refine((v) => !isNumbersOnlyText(v), lettersRequiredMessage('Title')),
    slug: z
      .string()
      .min(3)
      .max(220)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens only'),
    description: z.string().optional().nullable(),
    package_id: z.string().uuid().optional().nullable().or(z.literal('')),
    event_id: z.string().uuid().optional().nullable().or(z.literal('')),
    discount_percent: z.coerce
      .number({ invalid_type_error: 'Enter a valid percentage' })
      .min(0, 'Discount cannot be negative')
      .max(100, 'Discount cannot be more than 100%')
      .optional()
      .nullable(),
    discount_flat: z.coerce
      .number({ invalid_type_error: 'Enter a valid amount' })
      .min(0, 'Discount cannot be negative')
      .max(10_000_000, 'Discount looks too high')
      .optional()
      .nullable(),
    valid_from: z.string().min(1, 'Start date is required'),
    valid_to: z.string().min(1, 'End date is required'),
    // Convenience-only field, never stored: when set, the create form
    // computes valid_to as "today + N days" client-side instead of
    // requiring the admin to pick a specific end date.
    days_from_now: z.coerce.number().int().min(1).optional().nullable(),
    image_url: imageUrlSchema.optional().nullable().or(z.literal('')),
    terms: z.string().optional().nullable(),
  })
  .refine((d) => d.valid_to >= d.valid_from, {
    message: 'End date must be after start date',
    path: ['valid_to'],
  })
  .refine((d) => (d.discount_percent ?? 0) > 0 || (d.discount_flat ?? 0) > 0, {
    message: 'Enter a percentage or flat discount greater than 0',
    path: ['discount_percent'],
  })
  .refine((d) => !((d.discount_percent ?? 0) > 0 && (d.discount_flat ?? 0) > 0), {
    message: 'Use either a percentage or a flat discount, not both',
    path: ['discount_flat'],
  });

export type OfferFormValues = z.infer<typeof offerSchema>;

/** What a blog post needs before it can go live. Returns the error, or null. */
export function blogPublishError(post: { content?: string | null; cover_image_url?: string | null }): string | null {
  const text = (post.content ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
  const missing: string[] = [];
  if (!text) missing.push('content');
  if (!post.cover_image_url?.trim()) missing.push('a cover image');
  return missing.length ? `Can't publish yet — this post needs ${missing.join(' and ')}.` : null;
}
