'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { TextField, TextAreaField } from '@/components/ui/form-fields';
import { slugify } from '@/lib/validations/package';
import type { EventFormValues } from '@/lib/validations/content';
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

  function set<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = eventId ? await updateEvent(eventId, values) : await createEvent(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(eventId ? 'Event updated' : 'Event created as draft');
      if (!eventId && 'id' in result && result.id) {
        router.push(`/admin/events/${result.id}`);
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
        onChange={(e) => {
          set('title', e.target.value);
          if (!slugTouched) set('slug', slugify(e.target.value));
        }}
      />
      <TextField
        label="Slug"
        required
        value={values.slug ?? ''}
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
        <TextField
          label="Event date"
          type="date"
          value={values.event_date ?? ''}
          onChange={(e) => set('event_date', e.target.value)}
        />
        <TextField
          label="Location"
          value={values.location ?? ''}
          onChange={(e) => set('location', e.target.value)}
        />
        <TextField
          label="Cover image URL"
          value={values.image_url ?? ''}
          onChange={(e) => set('image_url', e.target.value)}
        />
        <TextField
          label="CTA label"
          value={values.cta_label ?? ''}
          onChange={(e) => set('cta_label', e.target.value)}
          placeholder="e.g. Register interest"
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
