import { z } from 'zod';

/** Whole count of people: blank/letters show a clear message instead of "Expected number, received nan". */
const peopleCount = (label: string, min: number) =>
  z.coerce
    .number({ invalid_type_error: `Enter the number of ${label}` })
    .int(`Number of ${label} must be a whole number`)
    .min(min, `Number of ${label} must be at least ${min}`)
    .max(99, `Number of ${label} looks too high (max 99)`);

/** Money amount in rupees. */
const amount = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `Enter a valid ${label}` })
    .min(0, `${label[0]!.toUpperCase()}${label.slice(1)} cannot be negative`)
    .max(100_000_000, `${label[0]!.toUpperCase()}${label.slice(1)} looks too high`);


export const bookingSchema = z
  .object({
    customer_id: z.string().uuid('Select a customer'),
    package_id: z.string().uuid('Select a package'),
    travel_start_date: z.string().min(1, 'Start date is required'),
    travel_end_date: z.string().min(1, 'End date is required'),
    number_of_adults: peopleCount('adults', 1),
    number_of_children: peopleCount('children', 0).default(0),
    number_of_infants: peopleCount('infants', 0).default(0),
    base_amount: amount('base amount'),
    discount_amount: amount('discount').default(0),
    tax_amount: amount('tax amount').default(0),
    notes: z.string().optional().nullable(),
  })
  .refine((d) => d.travel_end_date >= d.travel_start_date, {
    message: 'End date must be on or after the start date',
    path: ['travel_end_date'],
  })
  .refine((d) => d.discount_amount <= d.base_amount, {
    message: 'Discount cannot be more than the base amount',
    path: ['discount_amount'],
  });

export type BookingFormValues = z.infer<typeof bookingSchema>;

export const passengerSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long (max 120 characters)'),
  age: z.coerce
    .number({ invalid_type_error: 'Enter a valid age' })
    .int('Age must be a whole number')
    .min(0, 'Age cannot be negative')
    .max(120, 'Enter a valid age')
    .optional()
    .nullable(),
  gender: z.string().max(20).optional().nullable(),
  passenger_type: z.enum(['adult', 'child', 'infant']).default('adult'),
  id_proof_type: z.string().max(50).optional().nullable(),
  id_proof_number: z.string().trim().max(100).optional().nullable(),
});

export const paymentSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: 'Enter a valid amount' })
    .positive('Amount must be greater than 0')
    .max(100_000_000, 'Amount looks too high'),
  payment_method: z.enum(['cash', 'bank_transfer', 'upi', 'credit_card', 'debit_card', 'cheque', 'other']),
  payment_date: z.string().trim().min(1, 'Payment date is required'),
  reference_number: z.string().trim().max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
});
