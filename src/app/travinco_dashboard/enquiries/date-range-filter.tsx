'use client';

import { useEffect, useRef, useState } from 'react';
import { AdminDateField } from '@/components/admin/package-fields';
import { todayIso } from '@/lib/utils/iso-date';

/**
 * Enquiry Date from/to pickers for the GET filter form (submitted as ?from=&to=).
 * Picking or clearing a date applies the filter straight away.
 */
export function DateRangeFilter({ initialFrom = '', initialTo = '' }: { initialFrom?: string; initialTo?: string }) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [dirty, setDirty] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const today = todayIso();

  // Submit after the hidden inputs below have the new values
  useEffect(() => {
    if (!dirty) return;
    setDirty(false);
    const form = ref.current?.closest('form');
    form?.requestSubmit();
  }, [dirty, from, to]);

  return (
    <div ref={ref} className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <span className="text-xs font-medium text-ink-500">Enquiry date</span>
      <div className="min-w-[9.5rem] flex-1 sm:w-40 sm:flex-none" title="From">
        <AdminDateField
          value={from}
          onChange={(iso) => {
            setFrom(iso);
            // A To date before the new From date no longer makes sense
            if (iso && to && to < iso) setTo('');
            setDirty(true);
          }}
          min="2000-01-01"
          max={to || today}
        />
      </div>
      <span className="text-xs text-ink-400">to</span>
      <div className="min-w-[9.5rem] flex-1 sm:w-40 sm:flex-none" title="To">
        <AdminDateField
          value={to}
          onChange={(iso) => {
            setTo(iso);
            setDirty(true);
          }}
          min={from || '2000-01-01'}
          max={today}
        />
      </div>
    </div>
  );
}
