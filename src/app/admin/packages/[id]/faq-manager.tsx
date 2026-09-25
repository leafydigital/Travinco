'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { X, Plus, Pencil, Check } from 'lucide-react';
import type { Tables } from '@/types/database';

type Faq = Tables<'package_faqs'>;

export function FaqManager({
  packageId,
  faqs,
  onAdd,
  onUpdate,
  onRemove,
}: {
  packageId: string;
  faqs: Faq[];
  onAdd: (packageId: string, raw: { question: string; answer: string }) => Promise<{ error?: string }>;
  onUpdate: (
    packageId: string,
    id: string,
    raw: { question: string; answer: string }
  ) => Promise<{ error?: string }>;
  onRemove: (packageId: string, id: string) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [isPending, startTransition] = useTransition();

  function add() {
    if (!question.trim() || !answer.trim()) return;
    startTransition(async () => {
      const result = await onAdd(packageId, { question: question.trim(), answer: answer.trim() });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setQuestion('');
      setAnswer('');
      router.refresh();
    });
  }

  function startEdit(faq: Faq) {
    setEditingId(faq.id);
    setEditQuestion(faq.question);
    setEditAnswer(faq.answer);
  }

  function saveEdit(id: string) {
    if (!editQuestion.trim() || !editAnswer.trim()) return;
    startTransition(async () => {
      const result = await onUpdate(packageId, id, {
        question: editQuestion.trim(),
        answer: editAnswer.trim(),
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await onRemove(packageId, id);
      if (result.error) toast.error(result.error);
      router.refresh();
    });
  }

  return (
    <div>
      <p className="label">Frequently asked questions</p>
      <div className="space-y-3">
        {faqs.map((faq) =>
          editingId === faq.id ? (
            <div key={faq.id} className="space-y-2 rounded-lg border border-brand-200 bg-brand-50/40 p-3">
              <input
                type="text"
                value={editQuestion}
                onChange={(e) => setEditQuestion(e.target.value)}
                className="input w-full"
                placeholder="Question"
              />
              <textarea
                value={editAnswer}
                onChange={(e) => setEditAnswer(e.target.value)}
                rows={2}
                className="input w-full"
                placeholder="Answer"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="text-xs text-ink-500 hover:underline"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => saveEdit(faq.id)}
                  disabled={isPending}
                  className="btn-outline px-3 py-1.5 text-xs"
                >
                  <Check className="h-3.5 w-3.5" /> Save
                </button>
              </div>
            </div>
          ) : (
            <div key={faq.id} className="rounded-lg border border-ink-200 bg-ink-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-ink-800">{faq.question}</p>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(faq)}
                    className="rounded-lg p-1.5 text-ink-400 hover:bg-white hover:text-brand-600"
                    aria-label={`Edit ${faq.question}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(faq.id)}
                    disabled={isPending}
                    className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Remove ${faq.question}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="mt-1 text-sm text-ink-600">{faq.answer}</p>
            </div>
          )
        )}

        <div className="space-y-2 rounded-lg border border-dashed border-ink-200 p-3">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="input w-full"
            placeholder="Question, e.g. What is the cancellation policy?"
          />
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={2}
            className="input w-full"
            placeholder="Answer"
          />
          <div className="flex justify-end">
            <button type="button" onClick={add} disabled={isPending} className="btn-outline shrink-0">
              <Plus className="h-4 w-4" /> Add FAQ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
