'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { addPassenger, updatePassenger, removePassenger } from '../actions';
import { X, Pencil, Check } from 'lucide-react';
import type { Tables } from '@/types/database';

type PassengerForm = { full_name: string; age: string; passenger_type: 'adult' | 'child' | 'infant' };

export function PassengersPanel({
  bookingId,
  passengers,
}: {
  bookingId: string;
  passengers: Tables<'booking_passengers'>[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<PassengerForm>({ full_name: '', age: '', passenger_type: 'adult' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PassengerForm>({ full_name: '', age: '', passenger_type: 'adult' });

  function submit() {
    if (!form.full_name.trim()) {
      toast.error('Enter a passenger name.');
      return;
    }
    startTransition(async () => {
      const result = await addPassenger(bookingId, {
        full_name: form.full_name.trim(),
        age: form.age ? Number(form.age) : null,
        passenger_type: form.passenger_type,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setForm({ full_name: '', age: '', passenger_type: 'adult' });
      router.refresh();
    });
  }

  function startEdit(p: Tables<'booking_passengers'>) {
    setEditingId(p.id);
    setEditForm({
      full_name: p.full_name,
      age: p.age !== null ? String(p.age) : '',
      passenger_type: p.passenger_type as PassengerForm['passenger_type'],
    });
  }

  function saveEdit(passengerId: string) {
    if (!editForm.full_name.trim()) {
      toast.error('Enter a passenger name.');
      return;
    }
    startTransition(async () => {
      const result = await updatePassenger(bookingId, passengerId, {
        full_name: editForm.full_name.trim(),
        age: editForm.age ? Number(editForm.age) : null,
        passenger_type: editForm.passenger_type,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await removePassenger(bookingId, id);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="card space-y-4 p-5">
      <h2 className="text-sm font-semibold text-ink-800">Passengers</h2>
      <div className="space-y-2">
        {passengers.map((p) =>
          editingId === p.id ? (
            <div key={p.id} className="rounded-lg border border-brand-200 bg-brand-50/40 p-2.5">
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  value={editForm.full_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                  placeholder="Full name"
                  className="input"
                />
                <input
                  type="number"
                  min={0}
                  value={editForm.age}
                  onChange={(e) => setEditForm((f) => ({ ...f, age: e.target.value }))}
                  placeholder="Age"
                  className="input"
                />
                <select
                  value={editForm.passenger_type}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, passenger_type: e.target.value as PassengerForm['passenger_type'] }))
                  }
                  className="input"
                >
                  <option value="adult">Adult</option>
                  <option value="child">Child</option>
                  <option value="infant">Infant</option>
                </select>
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100"
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => saveEdit(p.id)}
                  disabled={isPending}
                  className="rounded-lg p-1.5 text-brand-600 hover:bg-brand-100"
                  aria-label="Save"
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-ink-100 p-2.5 text-sm">
              <div>
                <p className="font-medium text-ink-700">{p.full_name}</p>
                <p className="text-xs capitalize text-ink-400">
                  {p.passenger_type}
                  {p.age !== null && ` · Age ${p.age}`}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => startEdit(p)}
                  className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                  aria-label="Edit passenger"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => remove(p.id)}
                  disabled={isPending}
                  className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove passenger"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        )}
        {passengers.length === 0 && <p className="text-sm text-ink-400">No passengers added yet.</p>}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <input
          value={form.full_name}
          onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
          placeholder="Full name"
          className="input sm:col-span-1"
        />
        <input
          type="number"
          min={0}
          value={form.age}
          onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
          placeholder="Age"
          className="input"
        />
        <select
          value={form.passenger_type}
          onChange={(e) => setForm((f) => ({ ...f, passenger_type: e.target.value as PassengerForm['passenger_type'] }))}
          className="input"
        >
          <option value="adult">Adult</option>
          <option value="child">Child</option>
          <option value="infant">Infant</option>
        </select>
      </div>
      <button onClick={submit} disabled={isPending} className="btn-outline w-full">
        Add passenger
      </button>
    </div>
  );
}
