import { containsBadWords, badWordsError } from './contact-rules';
import { z } from 'zod';

export const enquiryFormSchema = z.object({
  customer_name: z
    .string({ required_error: 'Full name is required' })
    .trim()
    .min(1, 'Full name is required')
    .max(120, 'Full name must be under 120 characters')
    .refine((val) => !/\d/.test(val), {
      message: 'Enter valid full name',
    })
    .refine((val) => /^[a-zA-Z\s'.\-]+$/.test(val), {
      message: 'Full name can only contain letters and spaces',
    }),
  phone: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .min(1, 'Phone number is required')
    .max(30)
    .refine(
      (val) => {
        const digits = val.replace(/\D/g, '');
        return digits.length >= 7 && !/^0+$/.test(digits);
      },
      {
        message: 'Enter a valid mobile number',
      }
    ),
  whatsapp_number: z.string().max(30).optional().or(z.literal('')),
  email: z
    .string({ required_error: 'Email address is required' })
    .trim()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address (e.g. name@example.com)'),
  package_id: z.string().optional().or(z.literal('')),
  custom_package_name: z.string().max(200).optional().or(z.literal('')),
  destination: z.string().max(120).optional().or(z.literal('')),
  travel_date: z
    .string({ required_error: 'Travel date is required' })
    .min(1, 'Travel date is required')
    .refine(
      (val) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
        const parts = val.split('-');
        const selected = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
        if (Number.isNaN(selected.getTime())) return false;
        const minDate = new Date();
        minDate.setDate(minDate.getDate() + 2); // at least 2 days ahead
        minDate.setHours(0, 0, 0, 0);
        return selected >= minDate;
      },
      {
        message: 'Please choose a date at least 2 days from today',
      }
    )
    .refine(
      (val) => {
        const parts = val.split('-');
        const selected = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
        const maxDate = new Date();
        maxDate.setFullYear(maxDate.getFullYear() + 1); // at most 1 year from today
        // +1 day leeway: the server clock (UTC) can be a calendar day behind the visitor (IST)
        maxDate.setDate(maxDate.getDate() + 1);
        maxDate.setHours(0, 0, 0, 0);
        return selected <= maxDate;
      },
      {
        message: 'Please choose a date within 1 year from today',
      }
    ),
  number_of_adults: z.coerce.number().int().min(1).default(1),
  number_of_children: z.coerce.number().int().min(0).default(0),
  number_of_infants: z.coerce.number().int().min(0).default(0),
  budget: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((val) => (val && String(val).trim() ? parseFloat(String(val).trim()) : undefined))
    .refine((val) => val === undefined || (!Number.isNaN(val) && val >= 0), {
      message: 'Enter a valid budget amount',
    }),
  message: z
    .string()
    .max(2000)
    .refine((val) => !containsBadWords(val), { message: badWordsError('Special Requests / Notes') })
    .optional()
    .or(z.literal('')),
  // Honeypot field — real users never fill this in; bots often do.
  website: z.string().max(0, 'Spam detected').optional().or(z.literal('')),
});

export type EnquiryFormValues = z.infer<typeof enquiryFormSchema>;

