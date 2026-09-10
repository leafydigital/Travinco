'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { createWhatsappTemplate } from '../actions';

export function TemplateAddForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<{ name: string; category: 'marketing' | 'utility' | 'authentication'; body: string }>(
    { name: '', category: 'marketing', body: '' }
  );

  function submit() {
    startTransition(async () => {
      const result = await createWhatsappTemplate(form);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Template created');
      setForm({ name: '', category: 'marketing', body: '' });
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="h-4 w-4" /> New template
      </button>
    );
  }

  return (
    <div className="card space-y-3 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Template name, e.g. new_package_announcement"
          className="input"
        />
        <select
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as typeof f.category }))}
          className="input"
        >
          <option value="marketing">Marketing</option>
          <option value="utility">Utility</option>
          <option value="authentication">Authentication</option>
        </select>
      </div>
      <textarea
        value={form.body}
        onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
        rows={4}
        placeholder={'e.g. Hi {{1}}, we just launched a new package to {{2}}! Reply to learn more.'}
        className="input"
      />
      <div className="flex justify-end gap-2">
        <button onClick={() => setOpen(false)} className="btn-ghost">
          Cancel
        </button>
        <button onClick={submit} disabled={isPending || !form.name || !form.body} className="btn-primary">
          {isPending ? 'Saving…' : 'Create template'}
        </button>
      </div>
    </div>
  );
}
