'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { X, Plus } from 'lucide-react';
import type { FaqsSettingsFormValues } from '@/lib/validations/settings';
import { saveFaqsSettings } from './actions';

export function FaqsSettingsForm({
  initialValues,
}: {
  initialValues: Partial<FaqsSettingsFormValues>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState(initialValues.items ?? []);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  function addItem() {
    if (!question.trim() || !answer.trim()) return;
    setItems((prev) => [...prev, { question: question.trim(), answer: answer.trim() }]);
    setQuestion('');
    setAnswer('');
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveFaqsSettings({ items });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Common FAQs saved');
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
        These questions show on every package&apos;s detail page automatically — enter them once
        here instead of on each package. A package can still have its own extra FAQs added from
        its own edit page; those show in addition to these.
      </p>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start justify-between gap-2 rounded-lg border border-ink-200 bg-ink-50 p-3">
            <div>
              <p className="text-sm font-medium text-ink-800">{item.question}</p>
              <p className="mt-1 text-sm text-ink-600">{item.answer}</p>
            </div>
            <button
              type="button"
              onClick={() => removeItem(i)}
              className="shrink-0 rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
              aria-label={`Remove ${item.question}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-2 rounded-lg border border-dashed border-ink-200 p-3">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="input w-full"
          placeholder="Question, e.g. Can the itinerary be customized?"
        />
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={2}
          className="input w-full"
          placeholder="Answer"
        />
        <div className="flex justify-end">
          <button type="button" onClick={addItem} className="btn-outline shrink-0">
            <Plus className="h-4 w-4" /> Add FAQ
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={handleSave} disabled={isPending} className="btn-primary">
          {isPending ? 'Saving…' : 'Save common FAQs'}
        </button>
      </div>
    </div>
  );
}
