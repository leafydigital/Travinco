'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, X } from 'lucide-react';
import { updateEnquiryDetails } from '../actions';
import { PhoneInput, COUNTRY_PHONE_CODES } from '@/components/public/phone-input';
import { AdminDateField, blockNonNumericKeys, parseNonNegative } from '@/components/admin/package-fields';
import { addYearsIso, todayIso } from '@/lib/utils/iso-date';
import type { Tables } from '@/types/database';

function splitPhone(stored?: string | null): { dialCode: string; number: string } {
  if (!stored) return { dialCode: '+91', number: '' };
  const sorted = [...COUNTRY_PHONE_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const c of sorted) {
    if (stored.startsWith(c.code)) {
      return { dialCode: c.code, number: stored.slice(c.code.length) };
    }
  }
  return { dialCode: '+91', number: stored.replace(/\D/g, '') };
}

export function EnquiryDetailsEditForm({
  enquiry,
  canEdit = true,
  initialEditing = false,
}: {
  enquiry: Tables<'enquiries'>;
  canEdit?: boolean;
  initialEditing?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(initialEditing && canEdit);
  const [phoneValue, setPhoneValue] = useState(() => splitPhone(enquiry.phone));
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(
    !enquiry.whatsapp_number || enquiry.whatsapp_number === enquiry.phone
  );
  const [whatsappValue, setWhatsappValue] = useState(() => splitPhone(enquiry.whatsapp_number));
  const [values, setValues] = useState({
    customer_name: enquiry.customer_name,
    phone: enquiry.phone,
    whatsapp_number: enquiry.whatsapp_number ?? '',
    email: enquiry.email ?? '',
    destination: enquiry.destination ?? '',
    travel_date: enquiry.travel_date ?? '',
    return_date: enquiry.return_date ?? '',
    number_of_adults: enquiry.number_of_adults,
    number_of_children: enquiry.number_of_children,
    number_of_infants: enquiry.number_of_infants,
    budget: enquiry.budget ?? '',
    message: enquiry.message ?? '',
  });

  const [phoneValid, setPhoneValid] = useState(true);
  const [whatsappValid, setWhatsappValid] = useState(true);

  const today = todayIso();
  const maxTravelDate = addYearsIso(today, 1);
  const returnMin = values.travel_date || today;
  const maxReturnDate = addYearsIso(returnMin, 1);

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleTravelDateChange(iso: string) {
    setValues((v) => {
      const next = { ...v, travel_date: iso };
      // Drop a return date that no longer fits the new travel date.
      if (iso && v.return_date && (v.return_date < iso || v.return_date > addYearsIso(iso, 1))) {
        next.return_date = '';
      }
      return next;
    });
  }

  function validate(): string | null {
    const phoneDigits = phoneValue.number.replace(/\D/g, '');
    if (!phoneDigits) return 'Please enter a phone number.';
    if (/^0+$/.test(phoneDigits)) return 'Phone number cannot be all zeros.';
    if (!phoneValid) return 'Please enter a valid phone number.';
    if (!whatsappSameAsPhone && whatsappValue.number) {
      const waDigits = whatsappValue.number.replace(/\D/g, '');
      if (/^0+$/.test(waDigits)) return 'WhatsApp number cannot be all zeros.';
      if (!whatsappValid) return 'Please enter a valid WhatsApp number.';
    }
    if (values.travel_date && values.travel_date > maxTravelDate) {
      return 'Travel date must be within 1 year from today.';
    }
    if (values.travel_date && values.return_date) {
      if (values.return_date < values.travel_date) return 'Return date cannot be before the travel date.';
      if (values.return_date > addYearsIso(values.travel_date, 1)) {
        return 'Return date must be within 1 year of the travel date.';
      }
    }
    if (values.budget !== '' && Number(values.budget) < 0) return 'Budget cannot be negative.';
    return null;
  }

  function handleSave() {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }
    startTransition(async () => {
      const result = await updateEnquiryDetails(enquiry.id, values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Trip details updated');
      setEditing(false);
      router.refresh();
    });
  }

  if (!canEdit) {
    return null;
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="btn-outline"
      >
        <Pencil className="h-3.5 w-3.5" /> Edit trip details
      </button>
    );
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-800">Edit trip details</h3>
        <button type="button" onClick={() => setEditing(false)} className="text-ink-400 hover:text-ink-700">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Full name</label>
          <input
            value={values.customer_name}
            onChange={(e) => set('customer_name', e.target.value)}
            className="input"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Phone</label>
          <PhoneInput
            name="phone"
            required
            value={phoneValue}
            onValidityChange={setPhoneValid}
            onChange={(next) => {
              setPhoneValue(next);
              set('phone', `${next.dialCode}${next.number}`);
              if (whatsappSameAsPhone) {
                setWhatsappValue(next);
                set('whatsapp_number', `${next.dialCode}${next.number}`);
              }
            }}
          />
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-2 text-sm text-ink-600">
            <input
              type="checkbox"
              checked={whatsappSameAsPhone}
              onChange={(e) => {
                setWhatsappSameAsPhone(e.target.checked);
                if (e.target.checked) {
                  setWhatsappValue(phoneValue);
                  set('whatsapp_number', `${phoneValue.dialCode}${phoneValue.number}`);
                }
              }}
              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            Same number for WhatsApp
          </label>
          {!whatsappSameAsPhone && (
            <PhoneInput
              name="whatsapp_number"
              value={whatsappValue}
              onValidityChange={setWhatsappValid}
              onChange={(next) => {
                setWhatsappValue(next);
                set('whatsapp_number', `${next.dialCode}${next.number}`);
              }}
            />
          )}
        </div>
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            value={values.email}
            onChange={(e) => set('email', e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label">Destination</label>
          <input
            value={values.destination}
            onChange={(e) => set('destination', e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label">Travel date</label>
          <AdminDateField
            value={values.travel_date}
            onChange={handleTravelDateChange}
            min={today}
            max={maxTravelDate}
          />
        </div>
        <div>
          <label className="label">Return date</label>
          <AdminDateField
            value={values.return_date}
            onChange={(iso) => set('return_date', iso)}
            min={returnMin}
            max={maxReturnDate}
          />
        </div>
        <div>
          <label className="label">Budget (per person)</label>
          <input
            type="number"
            min={0}
            inputMode="decimal"
            value={values.budget}
            onKeyDown={(e) => blockNonNumericKeys(e)}
            onChange={(e) => {
              const parsed = parseNonNegative(e.target.value);
              if (parsed !== null) set('budget', parsed);
            }}
            className="input"
          />
        </div>
        <div>
          <label className="label">Adults</label>
          <input
            type="number"
            min={1}
            value={values.number_of_adults}
            onChange={(e) => set('number_of_adults', Number(e.target.value))}
            className="input"
          />
        </div>
        <div>
          <label className="label">Children</label>
          <input
            type="number"
            min={0}
            value={values.number_of_children}
            onChange={(e) => set('number_of_children', Number(e.target.value))}
            className="input"
          />
        </div>
        <div>
          <label className="label">Infants</label>
          <input
            type="number"
            min={0}
            value={values.number_of_infants}
            onChange={(e) => set('number_of_infants', Number(e.target.value))}
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="label">Message</label>
        <textarea
          rows={3}
          value={values.message}
          onChange={(e) => set('message', e.target.value)}
          className="input"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setEditing(false)} className="btn-outline">
          Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={isPending} className="btn-primary">
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
