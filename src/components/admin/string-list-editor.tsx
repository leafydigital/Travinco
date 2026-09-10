'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';

export function StringListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');

  function add() {
    const value = draft.trim();
    if (!value) return;
    onChange([...items, value]);
    setDraft('');
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div>
      <p className="label">{label}</p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="flex-1 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-700">
              {item}
            </span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"
              aria-label={`Remove ${item}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
            className="input flex-1"
          />
          <button type="button" onClick={add} className="btn-outline shrink-0">
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>
    </div>
  );
}
