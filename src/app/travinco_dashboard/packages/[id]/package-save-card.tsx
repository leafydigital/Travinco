'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';

export function PackageSaveCard({ formId = 'package-form' }: { formId?: string }) {
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleSavingState = (e: Event) => {
      const customEvent = e as CustomEvent<{ isSaving: boolean }>;
      setIsSaving(Boolean(customEvent.detail?.isSaving));
    };

    window.addEventListener('package-form-saving', handleSavingState);
    return () => {
      window.removeEventListener('package-form-saving', handleSavingState);
    };
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 border border-ink-200 shadow-sm">
      <div className="max-w-md">
        <p className="text-sm font-bold text-ink-900">Save Package Information</p>
        <p className="text-xs text-ink-500 mt-0.5">
          Updates basic information, pricing, duration, description and SEO settings above.
        </p>
      </div>
      <button
        type="submit"
        form={formId}
        disabled={isSaving}
        className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed transition"
      >
        {isSaving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Saving changes…</span>
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            <span>Save Changes</span>
          </>
        )}
      </button>
    </div>
  );
}
