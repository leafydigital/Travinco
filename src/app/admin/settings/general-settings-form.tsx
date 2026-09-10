'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { TextField, TextAreaField } from '@/components/ui/form-fields';
import type { GeneralSettingsFormValues } from '@/lib/validations/settings';
import { saveGeneralSettings } from './actions';

export function GeneralSettingsForm({
  initialValues,
}: {
  initialValues: Partial<GeneralSettingsFormValues>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Partial<GeneralSettingsFormValues>>({
    social: { facebook: '', instagram: '', twitter: '' },
    ...initialValues,
  });

  function set<K extends keyof GeneralSettingsFormValues>(key: K, value: GeneralSettingsFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveGeneralSettings(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Settings saved');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Business name"
          required
          value={values.business_name ?? ''}
          onChange={(e) => set('business_name', e.target.value)}
        />
        <TextField
          label="Logo URL"
          value={values.logo_url ?? ''}
          onChange={(e) => set('logo_url', e.target.value)}
        />
        <TextField label="Phone" value={values.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
        <TextField
          label="WhatsApp number"
          hint="Include country code, e.g. 919876543210 — used to build wa.me links"
          value={values.whatsapp ?? ''}
          onChange={(e) => set('whatsapp', e.target.value)}
        />
        <TextField
          label="Email"
          type="email"
          value={values.email ?? ''}
          onChange={(e) => set('email', e.target.value)}
        />
        <TextField label="Website" value={values.website ?? ''} onChange={(e) => set('website', e.target.value)} />
        <TextField
          label="Working hours"
          value={values.working_hours ?? ''}
          onChange={(e) => set('working_hours', e.target.value)}
          placeholder="Mon–Sat, 9:30 AM – 7:00 PM"
        />
      </div>
      <TextAreaField
        label="Office address"
        rows={2}
        value={values.address ?? ''}
        onChange={(e) => set('address', e.target.value)}
      />
      <TextField
        label="Google Maps embed URL"
        hint="From Google Maps → Share → Embed a map → copy the src URL"
        value={values.map_embed_url ?? ''}
        onChange={(e) => set('map_embed_url', e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Facebook"
          value={values.social?.facebook ?? ''}
          onChange={(e) => set('social', { ...values.social!, facebook: e.target.value })}
        />
        <TextField
          label="Instagram"
          value={values.social?.instagram ?? ''}
          onChange={(e) => set('social', { ...values.social!, instagram: e.target.value })}
        />
        <TextField
          label="Twitter / X"
          value={values.social?.twitter ?? ''}
          onChange={(e) => set('social', { ...values.social!, twitter: e.target.value })}
        />
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'Saving…' : 'Save general settings'}
        </button>
      </div>
    </form>
  );
}
