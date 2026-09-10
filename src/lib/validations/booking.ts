import { z } from 'zod';

export const bookingSchema = z
  .object({
    customer_id: z.string().uuid('Select a customer'),
    package_id: z.string().uuid('Select a package'),
    travel_start_date: z.string().min(1, 'Start date is required'),
    travel_end_date: z.string().min(1, 'End date is required'),
    number_of_adults: z.coerce.number().int().min(1),
    number_of_children: z.coerce.number().int().min(0).default(0),
    number_of_infants: z.coerce.number().int().min(0).default(0),
    base_amount: z.coerce.number().min(0),
    discount_amount: z.coerce.number().min(0).default(0),
    tax_amount: z.coerce.number().min(0).default(0),
    notes: z.string().optional().nullable(),
  })
  .refine((d) => d.travel_end_date >= d.travel_start_date, {
    message: 'End date must be on or after the start date',
    path: ['travel_end_date'],
  });

export type BookingFormValues = z.infer<typeof bookingSchema>;

export const passengerSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(120),
  age: z.coerce.number().int().min(0).max(130).optional().nullable(),
  gender: z.string().max(20).optional().nullable(),
  passenger_type: z.enum(['adult', 'child', 'infant']).default('adult'),
  id_proof_type: z.string().max(50).optional().nullable(),
  id_proof_number: z.string().max(100).optional().nullable(),
});

export const paymentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  payment_method: z.enum(['cash', 'bank_transfer', 'upi', 'credit_card', 'debit_card', 'cheque', 'other']),
  payment_date: z.string().min(1),
  reference_number: z.string().max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
});
