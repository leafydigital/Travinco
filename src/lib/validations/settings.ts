import { z } from 'zod';
import { imageUrlSchema } from './image-url';

export const destinationSchema = z.object({
  name: z.string().min(2, 'Name is required').max(120),
  slug: z
    .string()
    .min(2)
    .max(140)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens only'),
  country: z.string().max(100).optional().nullable(),
  description: z.string().optional().nullable(),
  cover_image_url: imageUrlSchema.optional().nullable().or(z.literal('')),
  is_featured: z.boolean().default(false),
  meta_title: z.string().max(160).optional().nullable(),
  meta_description: z.string().max(320).optional().nullable(),
});

export type DestinationFormValues = z.infer<typeof destinationSchema>;