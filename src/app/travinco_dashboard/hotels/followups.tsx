'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { addHotelFollowup, setHotelFollowupStatus } from './actions';
import { formatDate } from '@/lib/utils/format';

type Followup = { id: number; issue: string; action: string | null; status: 'OPEN' | 'DONE'; created_at: string };

export function HotelFollowups({ hotelId, items, canEdit }: { hotelId: number; items: Followup[]; canEdit: boolean }) {
  const router = useRouter();
  const [issue, setIssue] = useState('');
  const [action, setAction] = useState('');
  const [pending, start] = useTransition();

  const add = () =>
    start(async () => {
      const r = await addHotelFollowup(hotelId, issue, action);
      if (r.error) return void toast.error(r.error);
      setIssue('');
      setAction('');
      router.refresh();
    });
  const toggle = (f: Followup) =>
    start(async () => {
      const r = await setHotelFollowupStatus(hotelId, f.id, f.status === 'OPEN' ? 'DONE' : 'OPEN');
      if (r.error) return void toast.error(r.error);
      router.refresh();
    });

  return (
    <div className="card p-5">
      <h2 className="mb-3 font-semibold text-ink-900">Follow-ups</h2>
      <ul className="space-y-2">
        {items.length === 0 && <li className="text-sm text-ink-400">No open issues with this hotel.</li>}
        {items.map((f) => (
          <li key={f.id} className="flex items-start gap-3 rounded-lg border border-ink-100 p-3 text-sm">
            <input
              type="checkbox"
              checked={f.status === 'DONE'}
              disabled={!canEdit || pending}
              onChange={() => toggle(f)}
              className="mt-0.5 rounded border-ink-300 text-brand-700"
              aria-label="Mark done"
            />
            <div className="flex-1">
              <p className={f.status === 'DONE' ? 'text-ink-400 line-through' : 'text-ink-800'}>{f.issue}</p>
              {f.action && <p className="text-xs text-ink-500">Action: {f.action}</p>}
              <p className="text-xs text-ink-400">{formatDate(f.created_at)}</p>
            </div>
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="Issue (e.g. GST not confirmed)" className="input" />
          <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Action" className="input" />
          <button type="button" className="btn-outline" disabled={pending || !issue.trim()} onClick={add}>Add</button>
        </div>
      )}
    </div>
  );
}
