import { z } from 'zod';

export const enquiryFormSchema = z.object({
  customer_name: z.string().min(2, 'Please enter your name').max(120),
  phone: z.string().min(8, 'Enter a valid phone number').max(20),
  whatsapp_number: z.string().max(20).optional().or(z.literal('')),
  email: z.string().email('Enter a valid email — we verify it with a code'),
  package_id: z.string().uuid().optional().or(z.literal('')),
  destination: z.string().max(120).optional().or(z.literal('')),
  travel_date: z
    .string({ required_error: 'Please select your travel date' })
    .min(1, 'Please select your travel date')
    .refine(
      (val) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
        const selected = new Date(val + 'T00:00:00');
        if (Number.isNaN(selected.getTime())) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return selected >= today;
      },
      {
        message: 'Travel date cannot be in the past.',
      }
    ),
  number_of_adults: z.coerce.number().int().min(1).default(1),
  number_of_children: z.coerce.number().int().min(0).default(0),
  number_of_infants: z.coerce.number().int().min(0).default(0),
  budget: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((val) => (val ? Number(val) : undefined))
    .refine((val) => val === undefined || (!Number.isNaN(val) && val >= 0), {
      message: 'Enter a valid budget amount',
    }),
  message: z.string().max(2000).optional().or(z.literal('')),
  // Honeypot field — real users never fill this in; bots often do.
  website: z.string().max(0, 'Spam detected').optional().or(z.literal('')),
});

export type EnquiryFormValues = z.infer<typeof enquiryFormSchema>;
