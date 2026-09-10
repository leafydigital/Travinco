'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { addGalleryImage } from '../content-actions';

export function GalleryAddForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({ image_url: '', title: '', category: '' });

  function submit() {
    startTransition(async () => {
      const result = await addGalleryImage(form.image_url, form.title, form.category);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Image added');
      setForm({ image_url: '', title: '', category: '' });
      router.refresh();
    });
  }

  return (
    <div className="card flex flex-wrap items-center gap-2 p-4">
      <input
        value={form.image_url}
        onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
        placeholder="Image URL"
        className="input flex-1 min-w-[200px]"
      />
      <input
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        placeholder="Title (optional)"
        className="input w-auto"
      />
      <input
        value={form.category}
        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
        placeholder="Category (optional)"
        className="input w-auto"
      />
      <button onClick={submit} disabled={isPending} className="btn-primary shrink-0">
        <Plus className="h-4 w-4" /> Add
      </button>
    </div>
  );
}
