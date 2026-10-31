'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/admin-alert';
import { FieldWrapper, TextField, TextAreaField } from '@/components/ui/form-fields';
import { DatePickerDMY } from '@/components/public/date-picker-dmy';
import { slugify, fieldErrorsFromZod } from '@/lib/validations/package';
import { eventSchema, type EventFormValues } from '@/lib/validations/content';
import { createEvent, updateEvent } from '../content-actions';

export function EventForm({
  eventId,
  initialValues,
}: {
  eventId?: string;
  initialValues?: Partial<EventFormValues>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [slugTouched, setSlugTouched] = useState(Boolean(eventId));
  const [values, setValues] = useState<Partial<EventFormValues>>(initialValues ?? {});

  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key as string]) setErrors(({ [key as string]: _removed, ...rest }) => rest);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Same rules the server checks
    const check = eventSchema.safeParse(values);
    if (!check.success) {
      const fieldErrors = fieldErrorsFromZod(check.error);
      setErrors(fieldErrors);
      toast.error(Object.values(fieldErrors)[0] ?? 'Please fix the highlighted fields.');
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = eventId ? await updateEvent(eventId, values) : await createEvent(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(eventId ? 'Event updated' : 'Event created as draft');
      if (!eventId && 'id' in result && result.id) {
        router.push(`/travinco_dashboard/events/${result.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-5">
      <TextField
        label="Title"
        required
        value={values.title ?? ''}
        error={errors.title}
        aria-invalid={Boolean(errors.title)}
        onChange={(e) => {
          set('title', e.target.value);
          if (!slugTouched) set('slug', slugify(e.target.value));
        }}
      />
      <TextField
        label="Slug"
        required
        value={values.slug ?? ''}
        error={errors.slug}
        aria-invalid={Boolean(errors.slug)}
        onChange={(e) => {
          setSlugTouched(true);
          set('slug', e.target.value);
        }}
      />
      <TextAreaField
        label="Description"
        rows={4}
        value={values.description ?? ''}
        onChange={(e) => set('description', e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldWrapper label="Event date">
          <DatePickerDMY
            value={values.event_date ?? ''}
            onChange={(iso) => set('event_date', iso)}
            clearable
            label="Event date"
          />
        </FieldWrapper>
        <TextField
          label="Location"
          value={values.location ?? ''}
          onChange={(e) => set('location', e.target.value)}
        />
        <TextField
          label="Cover image URL"
          value={values.image_url ?? ''}
          error={errors.image_url}
          aria-invalid={Boolean(errors.image_url)}
          onChange={(e) => set('image_url', e.target.value)}
        />
        <TextField
          label="CTA label"
          value={values.cta_label ?? ''}
          onChange={(e) => set('cta_label', e.target.value)}
          placeholder="e.g. Register interest"
        />
        <TextField
          label="CTA link"
          value={values.cta_url ?? ''}
          onChange={(e) => set('cta_url', e.target.value)}
          placeholder="e.g. /contact or https://…"
          error={errors.cta_url}
          aria-invalid={Boolean(errors.cta_url)}
        />
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'Saving…' : eventId ? 'Save changes' : 'Create event'}
        </button>
      </div>
    </form>
  );
}
