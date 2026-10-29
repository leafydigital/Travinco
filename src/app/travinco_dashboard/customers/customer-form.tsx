'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { toast } from '@/lib/admin-alert';
import { HField, CountryInput } from '@/components/admin/horizontal-field';
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
        router.push(`/travinco_dashboard/customers/${result.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="card space-y-3.5 p-5">
        <HField label="Full name" required htmlFor="cust-name" fieldClassName="sm:max-w-[14rem]">
          <input
            id="cust-name"
            required
            className="input"
            placeholder="Enter full name"
            value={values.full_name ?? ''}
            onChange={(e) => set('full_name', e.target.value)}
          />
        </HField>

        <HField label="Phone" required fieldClassName="sm:max-w-md">
          <PhoneInput
            name="phone"
            required
            placeholder="Enter number"
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
        </HField>

        <HField label="WhatsApp" fieldClassName="sm:max-w-md">
          <label className="flex items-center gap-2 pt-2 text-sm text-ink-600">
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
            <div className="mt-2">
              <PhoneInput
                name="whatsapp_number"
                placeholder="Enter number"
                value={whatsappValue}
                onChange={(next) => {
                  setWhatsappValue(next);
                  set('whatsapp_number', `${next.dialCode}${next.number}`);
                }}
              />
            </div>
          )}
        </HField>

        <HField label="Email" htmlFor="cust-email" fieldClassName="sm:max-w-[14rem]">
          <input
            id="cust-email"
            type="email"
            className="input"
            placeholder="Enter email"
            value={values.email ?? ''}
            onChange={(e) => set('email', e.target.value)}
          />
        </HField>

        <div className="grid gap-3.5 lg:grid-cols-2">
          <HField label="City" htmlFor="cust-city" fieldClassName="sm:max-w-[14rem]">
            <input
              id="cust-city"
              className="input"
              value={values.city ?? ''}
              onChange={(e) => set('city', e.target.value)}
            />
          </HField>
          <HField label="State" htmlFor="cust-state" labelWidth="sm:w-32 lg:w-16" fieldClassName="sm:max-w-[14rem]">
            <input
              id="cust-state"
              className="input"
              value={values.state ?? ''}
              onChange={(e) => set('state', e.target.value)}
            />
          </HField>
        </div>

        <div className="grid gap-3.5 lg:grid-cols-2">
          <HField label="Country" htmlFor="cust-country" fieldClassName="sm:max-w-[14rem]">
            <CountryInput
              id="cust-country"
              value={values.country ?? 'India'}
              onChange={(v) => set('country', v)}
            />
          </HField>
          <HField label="Source" htmlFor="cust-source" labelWidth="sm:w-32 lg:w-16" fieldClassName="sm:max-w-[14rem]">
            <select
              id="cust-source"
              className="input"
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
            </select>
          </HField>
        </div>

        <HField label="Address" htmlFor="cust-address">
          <textarea
            id="cust-address"
            rows={2}
            className="input"
            value={values.address ?? ''}
            onChange={(e) => set('address', e.target.value)}
          />
        </HField>

        <HField label="Marketing">
          <label className="flex items-center gap-2 pt-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={values.whatsapp_opt_in ?? false}
              onChange={(e) => set('whatsapp_opt_in', e.target.checked)}
              className="rounded border-ink-300"
            />
            Customer has opted in to WhatsApp marketing messages
          </label>
        </HField>
      </div>

      <div className="card space-y-3.5 p-5">
        <HField label="Tags" fieldClassName="sm:max-w-md">
          <StringListEditor
            label=""
            items={values.tags ?? []}
            onChange={(tags) => set('tags', tags)}
            placeholder="e.g. repeat_customer"
          />
        </HField>
        <HField label="Notes" htmlFor="cust-notes">
          <textarea
            id="cust-notes"
            rows={3}
            className="input"
            value={values.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
          />
        </HField>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <Link
          href="/travinco_dashboard/customers"
          className="btn-outline inline-flex items-center gap-2 text-ink-700 hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </Link>
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? 'Saving…' : customerId ? 'Save changes' : 'Create customer'}
        </button>
      </div>
    </form>
  );
}
