/**
 * Expense payment methods. The DB column is an enum, so a custom method typed by
 * staff is stored as 'other' with its label kept on the first line of `notes`
 * as "[Payment method: <label>]".
 */

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'debit_card', label: 'Debit card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
] as const;

export type StandardPaymentMethod = (typeof PAYMENT_METHOD_OPTIONS)[number]['value'];

const MARKER = /^\[Payment method: ([^\]\n]{1,50})\]\n?/;

export function isStandardPaymentMethod(value: string): value is StandardPaymentMethod {
  return PAYMENT_METHOD_OPTIONS.some((o) => o.value === value);
}

/** Splits stored notes into the custom payment-method label and the remaining notes. */
export function splitPaymentNote(notes: string | null | undefined): { custom: string | null; rest: string | null } {
  if (!notes) return { custom: null, rest: null };
  const match = MARKER.exec(notes);
  if (!match) return { custom: null, rest: notes };
  const rest = notes.slice(match[0].length);
  return { custom: (match[1] ?? '').trim() || null, rest: rest || null };
}

/** Maps a submitted method (standard value or custom label) to the DB enum + notes. */
export function encodePaymentMethod(
  method: string,
  notes: string | null | undefined
): { payment_method: StandardPaymentMethod; notes: string | null } {
  const rest = splitPaymentNote(notes).rest;
  const trimmed = method.trim();
  if (isStandardPaymentMethod(trimmed)) return { payment_method: trimmed, notes: rest };
  const label = trimmed.replace(/[\]\n]/g, '').slice(0, 50);
  return { payment_method: 'other', notes: `[Payment method: ${label}]${rest ? `\n${rest}` : ''}` };
}

/** The value to show in a form: the custom label when one was stored, else the enum value. */
export function decodePaymentMethod(method: string | null | undefined, notes: string | null | undefined): string {
  const custom = splitPaymentNote(notes).custom;
  if (method === 'other' && custom) return custom;
  return method || 'bank_transfer';
}

export function paymentMethodLabel(method: string | null | undefined, notes?: string | null): string {
  const value = decodePaymentMethod(method, notes);
  return PAYMENT_METHOD_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
