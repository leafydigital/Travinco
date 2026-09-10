'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { TextField, TextAreaField, SelectField } from '@/components/ui/form-fields';
import { StringListEditor } from '@/components/admin/string-list-editor';
import type { CustomerFormValues } from '@/lib/validations/customer';
import { createCustomer, updateCustomer } from './actions';

export function CustomerForm({
  customerId,
  initialValues,
}: {
  customerId?: string;
  initialValues?: Partial<CustomerFormValues>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
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
          <TextField
            label="Phone"
            required
            value={values.phone ?? ''}
            onChange={(e) => set('phone', e.target.value)}
          />
          <TextField
            label="WhatsApp number"
            value={values.whatsapp_number ?? ''}
            onChange={(e) => set('whatsapp_number', e.target.value)}
          />
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
