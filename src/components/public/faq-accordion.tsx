'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function FaqAccordion({ faqs }: { faqs: { id: string; question: string; answer: string }[] }) {
  const [openId, setOpenId] = useState<string | null>(faqs[0]?.id ?? null);

  return (
    <div className="mt-4 divide-y divide-ink-100 rounded-xl2 border border-ink-100">
      {faqs.map((faq) => {
        const isOpen = openId === faq.id;
        return (
          <div key={faq.id}>
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : faq.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-ink-800"
              aria-expanded={isOpen}
            >
              {faq.question}
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 text-sm text-ink-600">{faq.answer}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
