'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { createWhatsappContact } from '../actions';

export function ContactAddForm({ customers }: { customers: { id: string; full_name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    phone: '',
    display_name: '',
    customer_id: '',
    tagsInput: '',
    opt_in: false,
  });

  function submit() {
    startTransition(async () => {
      const result = await createWhatsappContact({
        phone: form.phone,
        display_name: form.display_name || null,
        customer_id: form.customer_id || null,
        tags: form.tagsInput
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        opt_in: form.opt_in,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Contact added');
      setForm({ phone: '', display_name: '', customer_id: '', tagsInput: '', opt_in: false });
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="h-4 w-4" /> Add contact
      </button>
    );
  }

  return (
    <div className="card space-y-3 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          placeholder="Phone number (with country code)"
          className="input"
        />
        <input
          value={form.display_name}
          onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
          placeholder="Display name"
          className="input"
        />
        <select
          value={form.customer_id}
          onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
          className="input"
        >
          <option value="">Not linked to a customer</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </select>
        <input
          value={form.tagsInput}
          onChange={(e) => setForm((f) => ({ ...f, tagsInput: e.target.value }))}
          placeholder="Tags, comma separated"
          className="input"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input
          type="checkbox"
          checked={form.opt_in}
          onChange={(e) => setForm((f) => ({ ...f, opt_in: e.target.checked }))}
          className="rounded border-ink-300"
        />
        Customer has given consent to receive WhatsApp marketing messages
      </label>
      <div className="flex justify-end gap-2">
        <button onClick={() => setOpen(false)} className="btn-ghost">
          Cancel
        </button>
        <button onClick={submit} disabled={isPending || !form.phone} className="btn-primary">
          {isPending ? 'Saving…' : 'Add contact'}
        </button>
      </div>
    </div>
  );
}
