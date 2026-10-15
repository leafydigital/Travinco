'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { TextField, TextAreaField, SelectField } from '@/components/ui/form-fields';
import { StringListEditor } from '@/components/admin/string-list-editor';
import { PhoneInput, COUNTRY_PHONE_CODES } from '@/components/public/phone-input';
import type { CustomerFormValues } from '@/lib/validations/customer';
import { createCustomer, updateCustomer } from './actions';

/** Splits a stored "+91XXXXXXXXXX" string back into dial code + number
 * for editing in the PhoneInput widget — sorted so the longest dial
 * codes are checked first, since +91 must not match inside +919... */
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

export function CustomerForm({
  customerId,
  initialValues,
}: {
  customerId?: string;
  initialValues?: Partial<CustomerFormValues>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [phoneValue, setPhoneValue] = useState(() => splitPhone(initialValues?.phone));
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(
    !initialValues?.whatsapp_number || initialValues.whatsapp_number === initialValues.phone
  );
  const [whatsappValue, setWhatsappValue] = useState(() => splitPhone(initialValues?.whatsapp_number));
  const [values, setValues] = useState<Partial<CustomerFormValues>>({
    source: 'website',
    country: 'India',
    tags: [],
    whatsapp_opt_in: false,
    ...initialValues,
  });

  function set<K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = customerId
        ? await updateCustomer(customerId, values)
        : await createCustomer(values);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(customerId ? 'Customer updated' : 'Customer created');
      if (!customerId && 'id' in result && result.id) {
        router.push(`/admin/customers/${result.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Full name"
            required
            value={values.full_name ?? ''}
            onChange={(e) => set('full_name', e.target.value)}
          />
          <div className="sm:col-span-2">
            <label className="label">Phone</label>
            <PhoneInput
              name="phone"
              required
              value={phoneValue}
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
                onChange={(next) => {
                  setWhatsappValue(next);
                  set('whatsapp_number', `${next.dialCode}${next.number}`);
                }}
              />
            )}
          </div>
          <TextField
            label="Email"
            type="email"
            value={values.email ?? ''}
            onChange={(e) => set('email', e.target.value)}
          />
          <TextField
            label="City"
            value={values.city ?? ''}
            onChange={(e) => set('city', e.target.value)}
          />
          <TextField
            label="State"
            value={values.state ?? ''}
            onChange={(e) => set('state', e.target.value)}
          />
          <TextField
            label="Country"
            value={values.country ?? 'India'}
            onChange={(e) => set('country', e.target.value)}
          />
          <SelectField
            label="Source"
            value={values.source ?? 'website'}
            onChange={(e) => set('source', e.target.value as CustomerFormValues['source'])}
          >
            <option value="website">Website</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">Phone</option>
            <option value="walk_in">Walk-in</option>
            <option value="referral">Referral</option>
            <option value="social_media">Social media</option>
            <option value="other">Other</option>
          </SelectField>
        </div>
        <TextAreaField
          label="Address"
          rows={2}
          value={values.address ?? ''}
          onChange={(e) => set('address', e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={values.whatsapp_opt_in ?? false}
            onChange={(e) => set('whatsapp_opt_in', e.target.checked)}
            className="rounded border-ink-300"
          />
          Customer has opted in to WhatsApp marketing messages
        </label>
      </div>

      <div className="card space-y-4 p-5">
        <StringListEditor
          label="Tags"
          items={values.tags ?? []}
          onChange={(tags) => set('tags', tags)}
          placeholder="e.g. repeat_customer"
        />
        <TextAreaField
          label="Notes"
          rows={3}
          value={values.notes ?? ''}
          onChange={(e) => set('notes', e.target.value)}
        />
      </div>

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? 'Saving…' : customerId ? 'Save changes' : 'Create customer'}
        </button>
      </div>
    </form>
  );
}
