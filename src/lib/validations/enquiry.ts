import { z } from 'zod';

export const enquiryFormSchema = z.object({
  customer_name: z.string().min(2, 'Please enter your name').max(120),
  phone: z.string().min(8, 'Enter a valid phone number').max(20),
  whatsapp_number: z.string().max(20).optional().or(z.literal('')),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  package_id: z.string().uuid().optional().or(z.literal('')),
  destination: z.string().max(120).optional().or(z.literal('')),
  travel_date: z.string().optional().or(z.literal('')),
  number_of_adults: z.coerce.number().int().min(1).default(1),
  number_of_children: z.coerce.number().int().min(0).default(0),
  budget: z.coerce.number().min(0).optional().or(z.literal('' as unknown as number)),
  message: z.string().max(2000).optional().or(z.literal('')),
  // Honeypot field — real users never fill this in; bots often do.
  website: z.string().max(0, 'Spam detected').optional().or(z.literal('')),
});

export type EnquiryFormValues = z.infer<typeof enquiryFormSchema>;
