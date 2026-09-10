'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { TextField, TextAreaField } from '@/components/ui/form-fields';
import { replaceItineraryDay, deleteItineraryDay } from '../sub-resource-actions';
import type { Tables } from '@/types/database';

type ItineraryDay = Tables<'package_itineraries'>;

export function ItineraryManager({
  packageId,
  days,
}: {
  packageId: string;
  days: ItineraryDay[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState({
    day_number: days.length + 1,
    title: '',
    description: '',
    hotel: '',
    meals: '',
    transport: '',
  });

  function startEdit(day: ItineraryDay) {
    setEditingId(day.id);
    setIsAdding(false);
    setDraft({
      day_number: day.day_number,
      title: day.title,
      description: day.description ?? '',
      hotel: day.hotel ?? '',
      meals: day.meals ?? '',
      transport: day.transport ?? '',
    });
  }

  function startAdd() {
    setIsAdding(true);
    setEditingId(null);
    setDraft({
      day_number: (days[days.length - 1]?.day_number ?? 0) + 1,
      title: '',
      description: '',
      hotel: '',
      meals: '',
      transport: '',
    });
  }

  function cancel() {
    setEditingId(null);
    setIsAdding(false);
  }

  function save() {
    startTransition(async () => {
      const result = await replaceItineraryDay(packageId, editingId, {
        ...draft,
        activities: [],
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Itinerary day saved');
      cancel();
      router.refresh();
    });
  }

  function remove(dayId: string) {
    if (!confirm('Remove this itinerary day?')) return;
    startTransition(async () => {
      const result = await deleteItineraryDay(packageId, dayId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  const showForm = isAdding || editingId !== null;

  return (
    <div className="space-y-3">
      {days.map((day) => (
        <div key={day.id} className="rounded-lg border border-ink-100 p-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-ink-800">
                Day {day.day_number}: {day.title}
              </p>
              {day.description && <p className="mt-1 text-sm text-ink-500">{day.description}</p>}
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-ink-400">
                {day.hotel && <span>Hotel: {day.hotel}</span>}
                {day.meals && <span>Meals: {day.meals}</span>}
                {day.transport && <span>Transport: {day.transport}</span>}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => startEdit(day)}
                className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                aria-label="Edit day"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => remove(day.id)}
                className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                aria-label="Delete day"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {showForm ? (
        <div className="space-y-3 rounded-lg border border-brand-200 bg-brand-50/40 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Day number"
              type="number"
              min={1}
              value={draft.day_number}
              onChange={(e) => setDraft((d) => ({ ...d, day_number: Number(e.target.value) }))}
            />
            <TextField
              label="Title"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="e.g. Arrival & houseboat check-in"
            />
          </div>
          <TextAreaField
            label="Description"
            rows={3}
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField
              label="Hotel"
              value={draft.hotel}
              onChange={(e) => setDraft((d) => ({ ...d, hotel: e.target.value }))}
            />
            <TextField
              label="Meals"
              value={draft.meals}
              onChange={(e) => setDraft((d) => ({ ...d, meals: e.target.value }))}
              placeholder="Breakfast, Dinner"
            />
            <TextField
              label="Transport"
              value={draft.transport}
              onChange={(e) => setDraft((d) => ({ ...d, transport: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancel} className="btn-ghost">
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={isPending || !draft.title}
              className="btn-primary"
            >
              {isPending ? 'Saving…' : 'Save day'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={startAdd} className="btn-outline">
          <Plus className="h-4 w-4" /> Add itinerary day
        </button>
      )}
    </div>
  );
}
