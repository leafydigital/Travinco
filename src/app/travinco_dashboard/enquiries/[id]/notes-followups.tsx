'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { addEnquiryNote, scheduleFollowup, completeFollowup } from '../actions';
import { formatDate } from '@/lib/utils/format';
import { Check } from 'lucide-react';
import type { Tables } from '@/types/database';

export function NotesPanel({ enquiryId, notes }: { enquiryId: string; notes: string | null }) {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!draft.trim()) return;
    startTransition(async () => {
      const result = await addEnquiryNote(enquiryId, { note: draft.trim() });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setDraft('');
      router.refresh();
    });
  }

  return (
    <div className="card space-y-3 p-5">
      <h2 className="text-sm font-semibold text-ink-800">Notes</h2>
      {notes && (
        <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-ink-50 p-3 text-xs text-ink-600">
          {notes}
        </pre>
      )}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Add a note…"
          className="input flex-1"
        />
        <button onClick={submit} disabled={isPending} className="btn-outline shrink-0">
          Add
        </button>
      </div>
    </div>
  );
}

export function FollowupsPanel({
  enquiryId,
  followups,
}: {
  enquiryId: string;
  followups: Tables<'enquiry_followups'>[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<{
    followup_date: string;
    followup_time: string;
    followup_type: 'call' | 'whatsapp' | 'email' | 'meeting' | 'other';
    note: string;
  }>({
    followup_date: '',
    followup_time: '',
    followup_type: 'call',
    note: '',
  });

  function schedule() {
    if (!form.followup_date) {
      toast.error('Pick a follow-up date first.');
      return;
    }
    startTransition(async () => {
      const result = await scheduleFollowup(enquiryId, form);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Follow-up scheduled');
      setForm({ followup_date: '', followup_time: '', followup_type: 'call', note: '' });
      router.refresh();
    });
  }

  function complete(id: string) {
    startTransition(async () => {
      const result = await completeFollowup(enquiryId, id);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="card space-y-3 p-5">
      <h2 className="text-sm font-semibold text-ink-800">Follow-ups</h2>
      <div className="space-y-2">
        {followups.map((f) => (
          <div
            key={f.id}
            className={`flex items-center justify-between rounded-lg border p-2.5 text-sm ${
              f.is_completed ? 'border-ink-100 bg-ink-50 text-ink-400' : 'border-amber-200 bg-amber-50'
            }`}
          >
            <div>
              <p className={f.is_completed ? 'line-through' : 'font-medium text-ink-700'}>
                {formatDate(f.followup_date)} {f.followup_time ?? ''} — {f.followup_type}
              </p>
              {f.note && <p className="text-xs text-ink-500">{f.note}</p>}
            </div>
            {!f.is_completed && (
              <button
                onClick={() => complete(f.id)}
                disabled={isPending}
                className="rounded-full p-1.5 text-brand-600 hover:bg-brand-100"
                aria-label="Mark complete"
              >
                <Check className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {followups.length === 0 && <p className="text-sm text-ink-400">No follow-ups scheduled yet.</p>}
      </div>

      <div className="grid gap-2 border-t border-ink-100 pt-3 sm:grid-cols-2">
        <input
          type="date"
          value={form.followup_date}
          onChange={(e) => setForm((f) => ({ ...f, followup_date: e.target.value }))}
          className="input"
        />
        <input
          type="time"
          value={form.followup_time}
          onChange={(e) => setForm((f) => ({ ...f, followup_time: e.target.value }))}
          className="input"
        />
        <select
          value={form.followup_type}
          onChange={(e) =>
            setForm((f) => ({ ...f, followup_type: e.target.value as typeof f.followup_type }))
          }
          className="input"
        >
          <option value="call">Call</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
          <option value="meeting">Meeting</option>
          <option value="other">Other</option>
        </select>
        <input
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          placeholder="Note (optional)"
          className="input"
        />
      </div>
      <button onClick={schedule} disabled={isPending} className="btn-primary w-full">
        Schedule follow-up
      </button>
    </div>
  );
}
