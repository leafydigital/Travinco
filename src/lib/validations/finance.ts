import { z } from 'zod';

const paymentMethods = [
  'cash', 'bank_transfer', 'upi', 'credit_card', 'debit_card', 'cheque', 'other',
] as const;

export const incomeSchema = z.object({
  income_date: z.string().min(1, 'Date is required'),
  category: z.enum([
    'package_booking', 'flight', 'hotel', 'transport', 'visa', 'service_charge', 'other',
  ]),
  description: z.string().max(500).optional().nullable(),
  customer_id: z.string().uuid().optional().nullable().or(z.literal('')),
  booking_id: z.string().uuid().optional().nullable().or(z.literal('')),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  payment_method: z.enum(paymentMethods),
  reference_number: z.string().max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type IncomeFormValues = z.infer<typeof incomeSchema>;

export const expenseSchema = z.object({
  expense_date: z.string().min(1, 'Date is required'),
  category_id: z.string().uuid('Select a category'),
  supplier: z.string().max(200).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  booking_id: z.string().uuid().optional().nullable().or(z.literal('')),
  package_id: z.string().uuid().optional().nullable().or(z.literal('')),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  payment_method: z.enum(paymentMethods),
  reference_number: z.string().max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type ExpenseFormValues = z.infer<typeof expenseSchema>;
