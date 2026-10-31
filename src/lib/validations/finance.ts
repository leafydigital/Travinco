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
  category_id: z.string().min(1, 'Category is required'),
  supplier: z.string().max(200).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  booking_id: z.string().uuid().optional().nullable().or(z.literal('')),
  package_id: z.string().uuid().optional().nullable().or(z.literal('')),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  // A standard method or a custom label (see encodePaymentMethod).
  payment_method: z.string().trim().min(1, 'Payment method is required').max(50),
  reference_number: z.string().max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type ExpenseFormValues = z.infer<typeof expenseSchema>;

/* ── Invoice bank & UPI details (Settings → Invoice settings) ─────────── */

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER_RE = /^\d{9,18}$/;
/** name@handle, e.g. travinco1@fdl, shop.name-1@okaxis */
const UPI_ID_RE = /^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$/;

/** Errors keyed by field; empty when valid. These details are printed on invoices and drive the UPI QR code. */
export function validateInvoiceBankDetails(s: {
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_upi_id?: string;
  qr_code_mode?: string;
  custom_qr_url?: string | null;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!s.bank_name?.trim()) errors.bank_name = 'Bank name is required';
  if (!s.bank_account_name?.trim()) errors.bank_account_name = 'Account name is required';
  const account = (s.bank_account_number ?? '').replace(/\s/g, '');
  if (!account) errors.bank_account_number = 'Account number is required';
  else if (!ACCOUNT_NUMBER_RE.test(account)) errors.bank_account_number = 'Account number must be 9 to 18 digits';
  const ifsc = (s.bank_ifsc ?? '').trim().toUpperCase();
  if (!ifsc) errors.bank_ifsc = 'IFSC code is required';
  else if (!IFSC_RE.test(ifsc)) errors.bank_ifsc = 'IFSC code must be 11 characters, like FDRL0002204';
  const upi = (s.bank_upi_id ?? '').trim();
  if (s.qr_code_mode !== 'custom_image' && !upi) errors.bank_upi_id = 'UPI ID is required for the payment QR code';
  else if (upi && !UPI_ID_RE.test(upi)) errors.bank_upi_id = 'UPI ID must look like name@bank, e.g. travinco1@fdl';
  if (s.qr_code_mode === 'custom_image' && !s.custom_qr_url) errors.custom_qr_url = 'Upload a QR code image, or switch to the UPI QR code';
  return errors;
}

/** Indian GSTIN: 2-digit state code, PAN, entity number, 'Z', checksum (e.g. 32ABCDE1234F1Z5). */
export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
