'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { addPassenger, removePassenger } from '../actions';
import { X } from 'lucide-react';
import type { Tables } from '@/types/database';

export function PassengersPanel({
  bookingId,
  passengers,
}: {
  bookingId: string;
  passengers: Tables<'booking_passengers'>[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({ full_name: '', age: '', passenger_type: 'adult' as const });

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
        {passengers.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-lg border border-ink-100 p-2.5 text-sm">
            <div>
              <p className="font-medium text-ink-700">{p.full_name}</p>
              <p className="text-xs capitalize text-ink-400">
                {p.passenger_type}
                {p.age !== null && ` · Age ${p.age}`}
              </p>
            </div>
            <button
              onClick={() => remove(p.id)}
              disabled={isPending}
              className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
              aria-label="Remove passenger"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
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
          onChange={(e) => setForm((f) => ({ ...f, passenger_type: e.target.value as typeof f.passenger_type }))}
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
