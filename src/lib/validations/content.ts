import { z } from 'zod';

export const eventSchema = z.object({
  title: z.string().min(3, 'Title is required').max(200),
  slug: z
    .string()
    .min(3)
    .max(220)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens only'),
  description: z.string().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  event_date: z.string().optional().nullable(),
  image_url: z.string().url().optional().nullable().or(z.literal('')),
  cta_label: z.string().max(60).optional().nullable(),
  cta_url: z.string().optional().nullable(),
});

export type EventFormValues = z.infer<typeof eventSchema>;

export const offerSchema = z
  .object({
    title: z.string().min(3, 'Title is required').max(200),
    slug: z
      .string()
      .min(3)
      .max(220)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens only'),
    description: z.string().optional().nullable(),
    package_id: z.string().uuid().optional().nullable().or(z.literal('')),
    event_id: z.string().uuid().optional().nullable().or(z.literal('')),
    discount_percent: z.coerce.number().min(0).max(100).optional().nullable(),
    discount_flat: z.coerce.number().min(0).optional().nullable(),
    valid_from: z.string().min(1, 'Start date is required'),
    valid_to: z.string().min(1, 'End date is required'),
    image_url: z.string().url().optional().nullable().or(z.literal('')),
    terms: z.string().optional().nullable(),
  })
  .refine((d) => d.valid_to >= d.valid_from, {
    message: 'End date must be after start date',
    path: ['valid_to'],
  })
  .refine((d) => d.discount_percent != null || d.discount_flat != null, {
    message: 'Enter either a percentage or flat discount',
    path: ['discount_percent'],
  });

export type OfferFormValues = z.infer<typeof offerSchema>;
