'use client';

import { useState, useTransition } from 'react';
import { toast } from '@/lib/admin-alert';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { TextField, TextAreaField } from '@/components/ui/form-fields';
import { ConfirmDeleteDialog } from '@/components/admin/confirm-delete-dialog';
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
  const [dayToDelete, setDayToDelete] = useState<ItineraryDay | null>(null);
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
    if (!draft.title.trim()) {
      toast.error('Day title cannot be empty.');
      return;
    }
    if (!draft.day_number || draft.day_number < 1) {
      toast.error('Day number must be 1 or more.');
      return;
    }
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

  function handleDeleteConfirm(day: ItineraryDay) {
    startTransition(async () => {
      const result = await deleteItineraryDay(packageId, day.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Day ${day.day_number} removed`);
      setDayToDelete(null);
      router.refresh();
    });
  }

  const editorForm = (
    <div className="space-y-3 rounded-lg border border-brand-200 bg-brand-50/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
        {editingId ? `Editing day ${draft.day_number || ''}` : 'New itinerary day'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Day number"
          type="number"
          min={1}
          value={draft.day_number || ''}
          onKeyDown={(e) => {
            if (['-', '+', 'e', 'E', '.'].includes(e.key)) e.preventDefault();
          }}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            setDraft((d) => ({ ...d, day_number: Number.isFinite(n) && n > 0 ? n : 0 }));
          }}
        />
        <TextField
          label="Title"
          autoFocus
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
          disabled={isPending || !draft.title.trim() || !draft.day_number}
          className="btn-primary"
        >
          {isPending ? 'Saving…' : 'Save day'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {days.map((day) =>
        editingId === day.id ? (
          <div key={day.id}>{editorForm}</div>
        ) : (
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
                  disabled={isPending}
                  className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                  aria-label="Edit day"
                  title="Edit this day"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  data-no-confirm-save="true"
                  onClick={() => setDayToDelete(day)}
                  className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 transition cursor-pointer"
                  aria-label="Delete day"
                  title="Remove this day"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {isAdding ? (
        editorForm
      ) : (
        <button type="button" onClick={startAdd} className="btn-outline">
          <Plus className="h-4 w-4" /> Add itinerary day
        </button>
      )}

      {/* Itinerary Day Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={Boolean(dayToDelete)}
        isPending={isPending}
        title="Remove Itinerary Day"
        description={
          dayToDelete ? (
            <div className="space-y-2 text-left">
              <p className="text-sm text-ink-700">
                Are you sure you want to remove{' '}
                <strong>Day {dayToDelete.day_number}</strong>
                {dayToDelete.title ? `: "${dayToDelete.title}"` : ''} from this package?
              </p>
              <p className="text-xs text-ink-500">
                This will delete this day and its details permanently.
              </p>
            </div>
          ) : null
        }
        confirmLabel="Remove Day"
        onConfirm={() => {
          if (dayToDelete) {
            handleDeleteConfirm(dayToDelete);
          }
        }}
        onClose={() => setDayToDelete(null)}
      />
    </div>
  );
}
