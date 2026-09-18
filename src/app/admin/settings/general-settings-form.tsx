'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { TextField, TextAreaField } from '@/components/ui/form-fields';
import type { GeneralSettingsFormValues } from '@/lib/validations/settings';
import { saveGeneralSettings } from './actions';
import { uploadLogoImage } from './upload-actions';

export function GeneralSettingsForm({
  initialValues,
}: {
  initialValues: Partial<GeneralSettingsFormValues>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [values, setValues] = useState<Partial<GeneralSettingsFormValues>>({
    social: { facebook: '', instagram: '', twitter: '' },
    ...initialValues,
  });

  function set<K extends keyof GeneralSettingsFormValues>(key: K, value: GeneralSettingsFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.set('file', file);
    const result = await uploadLogoImage(formData);
    if (result.error) {
      toast.error(result.error);
    } else if (result.url) {
      set('logo_url', result.url);
      toast.success('Logo uploaded');
    }
    setIsUploading(false);
    e.target.value = '';
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
        <div>
          <label className="label">Logo</label>
          {values.logo_url && (
            <div className="mb-2 h-16 w-40 overflow-hidden rounded-lg border border-ink-100 bg-white p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={values.logo_url} alt="" className="h-full w-full object-contain" />
            </div>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleLogoSelect}
            disabled={isUploading}
            className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
          />
          {isUploading && <p className="mt-1.5 text-xs text-brand-600">Uploading…</p>}
        </div>
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
