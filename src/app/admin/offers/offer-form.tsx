'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { TextField, SelectField } from '@/components/ui/form-fields';
import { slugify } from '@/lib/validations/package';
import type { OfferFormValues } from '@/lib/validations/content';
import { createOffer, updateOffer } from '../content-actions';

type PackageOption = { id: string; title: string; base_price: number; currency: string };

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function OfferForm({
  offerId,
  initialValues,
  packages,
}: {
  offerId?: string;
  initialValues?: Partial<OfferFormValues>;
  packages: PackageOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [slugTouched, setSlugTouched] = useState(Boolean(offerId));
  const [endMode, setEndMode] = useState<'days' | 'date'>(
    initialValues?.valid_to ? 'date' : 'days'
  );
  const [values, setValues] = useState<Partial<OfferFormValues>>({
    valid_from: new Date().toISOString().slice(0, 10),
    days_from_now: 7,
    ...initialValues,
  });

  function set<K extends keyof OfferFormValues>(key: K, value: OfferFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handlePackageSelect(packageId: string) {
    const pkg = packages.find((p) => p.id === packageId);
    set('package_id', packageId);
    if (pkg && !values.title) {
      const title = `Special offer — ${pkg.title}`;
      set('title', title);
      if (!slugTouched) set('slug', slugify(title));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validTo =
      endMode === 'days' && values.days_from_now
        ? addDays(values.days_from_now)
        : values.valid_to;

    const submitValues = { ...values, valid_to: validTo };

    startTransition(async () => {
      const result = offerId
        ? await updateOffer(offerId, submitValues)
        : await createOffer(submitValues);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(offerId ? 'Special offer updated' : 'Special offer created');
      if (!offerId && 'id' in result && result.id) {
        router.push(`/admin/offers/${result.id}`);
      } else {
        router.refresh();
      }
    });
  }

  const selectedPackage = packages.find((p) => p.id === values.package_id);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-ink-800">Which package is this offer for?</h2>
        <SelectField
          label="Package"
          required
          value={values.package_id ?? ''}
          onChange={(e) => handlePackageSelect(e.target.value)}
        >
          <option value="">Select a package…</option>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </SelectField>
        {selectedPackage && (
          <p className="text-xs text-ink-500">
            Normal price: {selectedPackage.currency} {selectedPackage.base_price.toLocaleString()}
          </p>
        )}
      </div>

      <div className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-ink-800">Discount</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Discount percent"
            type="number"
            min={0}
            max={100}
            value={values.discount_percent ?? ''}
            onChange={(e) => set('discount_percent', e.target.value ? Number(e.target.value) : null)}
          />
          <TextField
            label="Or flat amount off"
            type="number"
            min={0}
            value={values.discount_flat ?? ''}
            onChange={(e) => set('discount_flat', e.target.value ? Number(e.target.value) : null)}
          />
        </div>
      </div>

      <div className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-ink-800">How long should this offer run?</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEndMode('days')}
            className={endMode === 'days' ? 'btn-primary' : 'btn-outline'}
          >
            Number of days
          </button>
          <button
            type="button"
            onClick={() => setEndMode('date')}
            className={endMode === 'date' ? 'btn-primary' : 'btn-outline'}
          >
            Specific end date
          </button>
        </div>

        {endMode === 'days' ? (
          <TextField
            label="Runs for how many days from today"
            type="number"
            min={1}
            value={values.days_from_now ?? 7}
            onChange={(e) => set('days_from_now', Number(e.target.value))}
            hint={`Ends automatically on ${addDays(values.days_from_now || 7)} — the package returns to its normal price and the offer badge disappears on its own after that.`}
          />
        ) : (
          <TextField
            label="Ends on"
            type="date"
            required
            value={values.valid_to ?? ''}
            onChange={(e) => set('valid_to', e.target.value)}
            hint="The package returns to its normal price and the offer badge disappears automatically once this date passes."
          />
        )}
      </div>

      <div className="flex justify-end gap-3">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'Saving…' : offerId ? 'Save changes' : 'Create special offer'}
        </button>
      </div>
    </form>
  );
}
