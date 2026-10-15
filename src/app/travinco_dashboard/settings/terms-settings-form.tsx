'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { TextAreaField } from '@/components/ui/form-fields';
import type { TermsSettingsFormValues } from '@/lib/validations/settings';
import { saveTermsSettings } from './actions';

export function TermsSettingsForm({
  initialValues,
}: {
  initialValues: Partial<TermsSettingsFormValues>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Partial<TermsSettingsFormValues>>(initialValues);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveTermsSettings(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Terms & conditions saved');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
        This text is shown on every package&apos;s detail page — you no longer need to enter
        terms separately for each package.
      </p>
      <TextAreaField
        label="Terms & conditions"
        rows={10}
        value={values.terms_and_conditions ?? ''}
        onChange={(e) => setValues((v) => ({ ...v, terms_and_conditions: e.target.value }))}
      />
      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'Saving…' : 'Save terms & conditions'}
        </button>
      </div>
    </form>
  );
}
