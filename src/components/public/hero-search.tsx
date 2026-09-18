'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MapPin, CalendarDays, Users, Minus, Plus } from 'lucide-react';

export function HeroSearch({ destinations }: { destinations: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [travelersOpen, setTravelersOpen] = useState(false);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);

  function adjust(setter: (fn: (n: number) => number) => void, min: number, delta: number) {
    setter((n) => Math.max(min, n + delta));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const destination = formData.get('destination');
    const travelDate = formData.get('travel_date');
    const params = new URLSearchParams();
    if (destination) params.set('destination', String(destination));
    if (travelDate) params.set('travel_date', String(travelDate));
    params.set('adults', String(adults));
    params.set('children', String(children));
    params.set('infants', String(infants));
    router.push(`/packages?${params.toString()}`);
  }

  const travelerSummary = [
    `${adults} ${adults === 1 ? 'Adult' : 'Adults'}`,
    children > 0 ? `${children} ${children === 1 ? 'Child' : 'Children'}` : null,
    infants > 0 ? `${infants} ${infants === 1 ? 'Infant' : 'Infants'}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-2 rounded-xl2 bg-white p-2.5 shadow-lg sm:grid-cols-[1.4fr_1fr_1fr_auto]"
    >
      <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 sm:border-r sm:border-ink-100">
        <MapPin className="h-4 w-4 shrink-0 text-brand-600" />
        <select
          name="destination"
          className="w-full border-none bg-transparent p-0 text-sm text-ink-700 focus:ring-0"
        >
          <option value="">Where to?</option>
          {destinations.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 sm:border-r sm:border-ink-100">
        <CalendarDays className="h-4 w-4 shrink-0 text-brand-600" />
        <input
          type="date"
          name="travel_date"
          className="w-full border-none bg-transparent p-0 text-sm text-ink-700 focus:ring-0"
        />
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setTravelersOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left sm:border-r sm:border-ink-100"
        >
          <Users className="h-4 w-4 shrink-0 text-brand-600" />
          <span className="truncate text-sm text-ink-700">{travelerSummary}</span>
        </button>

        {travelersOpen && (
          <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-xl2 border border-ink-100 bg-white p-4 shadow-lg">
            {[
              { label: 'Adults', hint: '12+ years', value: adults, setValue: setAdults, min: 1 },
              { label: 'Children', hint: '2–11 years', value: children, setValue: setChildren, min: 0 },
              { label: 'Infants', hint: 'Under 2 years', value: infants, setValue: setInfants, min: 0 },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-ink-800">{row.label}</p>
                  <p className="text-xs text-ink-400">{row.hint}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => adjust(row.setValue, row.min, -1)}
                    disabled={row.value <= row.min}
                    className="rounded-full border border-ink-200 p-1 text-ink-600 disabled:opacity-30"
                    aria-label={`Decrease ${row.label}`}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-4 text-center text-sm text-ink-800">{row.value}</span>
                  <button
                    type="button"
                    onClick={() => adjust(row.setValue, row.min, 1)}
                    className="rounded-full border border-ink-200 p-1 text-ink-600"
                    aria-label={`Increase ${row.label}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setTravelersOpen(false)}
              className="btn-primary mt-2 w-full justify-center"
            >
              Done
            </button>
          </div>
        )}
      </div>

      <button type="submit" className="btn-primary shrink-0 justify-center">
        <Search className="h-4 w-4" />
        <span className="sm:hidden lg:inline">Search packages</span>
      </button>
    </form>
  );
}
