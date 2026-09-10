'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { createExpenseCategory } from '../finance-actions';
import type { Tables } from '@/types/database';

export function ExpenseCategoryManager({ categories }: { categories: Tables<'expense_categories'>[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [isPending, startTransition] = useTransition();

  function add() {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await createExpenseCategory(name);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setName('');
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <span key={c.id} className="badge bg-ink-100 text-ink-700">
            {c.name}
          </span>
        ))}
        {categories.length === 0 && <p className="text-sm text-ink-400">No expense categories yet.</p>}
      </div>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="e.g. Hotel, Transport, Marketing"
          className="input flex-1"
        />
        <button onClick={add} disabled={isPending} className="btn-outline shrink-0">
          <Plus className="h-4 w-4" /> Add category
        </button>
      </div>
    </div>
  );
}
