import { z } from 'zod';
import { isValidPhoneNumber } from 'libphonenumber-js/mobile';
import { validateFullName, validateEmailAddress } from '@/lib/validations/contact-rules';
import { isFakePhone } from '@/lib/validations/phone';
import { passwordMeetsRules } from '@/lib/temp-password';

const isRealPhone = (v: string) => isValidPhoneNumber(v) && !isFakePhone(v);

export const customerSchema = z.object({
  full_name: z
    .string({ required_error: 'Full name is required' })
    .trim()
    .superRefine((v, ctx) => {
      const err = validateFullName(v);
      if (err) ctx.addIssue({ code: 'custom', message: err });
    }),
  phone: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .min(1, 'Phone number is required')
    .refine(isRealPhone, 'Please enter a valid phone number'),
  whatsapp_number: z
    .string()
    .trim()
    .refine((v) => !v || isRealPhone(v), 'Please enter a valid WhatsApp number')
    .optional()
    .nullable(),
  email: z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      if (!v) return;
      const err = validateEmailAddress(v);
      if (err) ctx.addIssue({ code: 'custom', message: err });
    })
    .optional()
    .nullable(),
  address: z.string().max(500, 'Address is too long (max 500 characters)').optional().nullable(),
  city: z.string().max(100, 'City is too long').optional().nullable(),
  state: z.string().max(100, 'State is too long').optional().nullable(),
  country: z.string().max(100, 'Country is too long').default('India'),
  source: z.enum(['website', 'whatsapp', 'phone', 'walk_in', 'referral', 'social_media', 'other'], {
    errorMap: () => ({ message: 'Please choose where the customer came from' }),
  }),
  tags: z.array(z.string()).default([]),
  notes: z.string().max(2000, 'Notes are too long (max 2000 characters)').optional().nullable(),
  whatsapp_opt_in: z.boolean().default(false),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;

/**
 * New customer created by the team: also gets a website login, so the email and a
 * password are required.
 */
export const newCustomerSchema = customerSchema.extend({
  email: z
    .string({ required_error: 'Email address is required' })
    .trim()
    .superRefine((v, ctx) => {
      const err = validateEmailAddress(v);
      if (err) ctx.addIssue({ code: 'custom', message: err });
    }),
  password: z
    .string({ required_error: 'Password is required' })
    .refine(passwordMeetsRules, 'Password must have 7+ characters with a capital letter, a lowercase letter, a number and a symbol'),
});
