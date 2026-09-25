'use client';

import { useState, type ReactNode } from 'react';

export function PackageTabs({
  tabs,
}: {
  tabs: { id: string; label: string; content: ReactNode }[];
}) {
  const [active, setActive] = useState(tabs[0]?.id ?? '');

  return (
    <div>
      <div className="flex flex-wrap gap-1 rounded-full border border-ink-100 bg-white p-1 sm:inline-flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              active === tab.id
                ? 'bg-brand-500 text-white'
                : 'text-ink-600 hover:bg-ink-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tabs.map((tab) => (
          <div key={tab.id} className={active === tab.id ? 'space-y-10' : 'hidden'}>
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
