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
    <button
      type="submit"
      form={formId}
      disabled={isSaving}
      title="Saves basic information, pricing, duration, description, highlights and SEO settings"
      className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed transition"
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
  );
}
