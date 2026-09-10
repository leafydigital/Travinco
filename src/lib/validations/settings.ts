import { z } from 'zod';

export const generalSettingsSchema = z.object({
  business_name: z.string().min(1, 'Business name is required').max(200),
  logo_url: z.string().url().optional().or(z.literal('')),
  phone: z.string().max(20).optional().or(z.literal('')),
  whatsapp: z.string().max(20).optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  social: z.object({
    facebook: z.string().optional().or(z.literal('')),
    instagram: z.string().optional().or(z.literal('')),
    twitter: z.string().optional().or(z.literal('')),
  }),
  working_hours: z.string().max(200).optional().or(z.literal('')),
  map_embed_url: z.string().optional().or(z.literal('')),
});

export type GeneralSettingsFormValues = z.infer<typeof generalSettingsSchema>;

export const bookingSettingsSchema = z.object({
  booking_prefix: z.string().max(10).default('BK'),
  currency: z.string().length(3).default('INR'),
  default_tax_percent: z.coerce.number().min(0).max(100).default(0),
  booking_terms: z.string().optional().or(z.literal('')),
});

export type BookingSettingsFormValues = z.infer<typeof bookingSettingsSchema>;

export const destinationSchema = z.object({
  name: z.string().min(2, 'Name is required').max(120),
  slug: z
    .string()
    .min(2)
    .max(140)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens only'),
  country: z.string().max(100).optional().nullable(),
  description: z.string().optional().nullable(),
  cover_image_url: z.string().url().optional().nullable().or(z.literal('')),
  is_featured: z.boolean().default(false),
  meta_title: z.string().max(160).optional().nullable(),
  meta_description: z.string().max(320).optional().nullable(),
});

export type DestinationFormValues = z.infer<typeof destinationSchema>;
