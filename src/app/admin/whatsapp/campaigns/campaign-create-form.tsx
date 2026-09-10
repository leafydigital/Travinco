'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { createWhatsappCampaign } from '../actions';

export function CampaignCreateForm({ templates }: { templates: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: '',
    template_id: '',
    audience_tag: '',
    scheduled_at: '',
  });

  function submit() {
    if (!form.template_id) {
      toast.error('Select a template — create one first if none exist.');
      return;
    }
    startTransition(async () => {
      const result = await createWhatsappCampaign(form);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Campaign created with ${result.recipientCount ?? 0} opted-in recipient${
          result.recipientCount === 1 ? '' : 's'
        }`
      );
      if (result.id) router.push(`/admin/whatsapp/campaigns/${result.id}`);
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="h-4 w-4" /> New campaign
      </button>
    );
  }

  return (
    <div className="card space-y-3 p-5">
      {templates.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No templates yet — create one on the Templates tab first.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Campaign name, e.g. Diwali offer blast"
          className="input"
        />
        <select
          value={form.template_id}
          onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))}
          className="input"
        >
          <option value="">Select template…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          value={form.audience_tag}
          onChange={(e) => setForm((f) => ({ ...f, audience_tag: e.target.value }))}
          placeholder="Audience tag filter (optional)"
          className="input"
        />
        <input
          type="datetime-local"
          value={form.scheduled_at}
          onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))}
          className="input"
        />
      </div>
      <p className="text-xs text-ink-400">
        Only contacts with a valid opt-in are added as recipients — this is enforced by the
        database, not just this form.
      </p>
      <div className="flex justify-end gap-2">
        <button onClick={() => setOpen(false)} className="btn-ghost">
          Cancel
        </button>
        <button onClick={submit} disabled={isPending || !form.name} className="btn-primary">
          {isPending ? 'Creating…' : 'Create campaign'}
        </button>
      </div>
    </div>
  );
}
