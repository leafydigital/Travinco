import { z } from 'zod';

export const customerSchema = z.object({
  full_name: z.string().min(2, 'Name is required').max(120),
  phone: z.string().min(8, 'Enter a valid phone number').max(20),
  whatsapp_number: z.string().max(20).optional().nullable(),
  email: z.string().email('Enter a valid email').optional().nullable().or(z.literal('')),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  country: z.string().max(100).default('India'),
  source: z.enum(['website', 'whatsapp', 'phone', 'walk_in', 'referral', 'social_media', 'other']),
  tags: z.array(z.string()).default([]),
  notes: z.string().max(2000).optional().nullable(),
  whatsapp_opt_in: z.boolean().default(false),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;
