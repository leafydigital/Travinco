'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';

type Staged = { file: File; preview: string };

/**
 * File picker that does NOT upload on selection. Chosen photos are previewed
 * first; nothing is uploaded until the admin clicks "Save photos".
 */
export function StagedImagePicker({
  onSave,
  disabled,
  onPendingChange,
}: {
  /** Uploads the files; resolve once done. Files that failed can be returned to keep them staged. */
  onSave: (files: File[]) => Promise<File[] | void>;
  disabled?: boolean;
  /** Notified with the number of selected-but-unsaved photos. */
  onPendingChange?: (count: number) => void;
}) {
  const [staged, setStaged] = useState<Staged[]>([]);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const stagedRef = useRef(staged);
  stagedRef.current = staged;

  useEffect(() => {
    onPendingChange?.(staged.length);
  }, [staged.length, onPendingChange]);

  // Free object URLs on unmount
  useEffect(() => () => stagedRef.current.forEach((s) => URL.revokeObjectURL(s.preview)), []);

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length) {
      setStaged((prev) => [...prev, ...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
    }
    e.target.value = '';
  }

  function removeAt(index: number) {
    setStaged((prev) => {
      const item = prev[index];
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function save() {
    if (!staged.length || saving) return;
    setSaving(true);
    try {
      const failed = (await onSave(staged.map((s) => s.file))) || [];
      setStaged((prev) => {
        const keep = prev.filter((s) => failed.includes(s.file));
        prev.filter((s) => !failed.includes(s.file)).forEach((s) => URL.revokeObjectURL(s.preview));
        return keep;
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleSelect}
        disabled={disabled || saving}
        className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
      />

      {staged.length > 0 && (
        <div className="space-y-2 rounded-xl border border-dashed border-brand-300 bg-brand-50/40 p-2.5">
          <p className="text-xs font-medium text-brand-800">
            {staged.length} photo{staged.length === 1 ? '' : 's'} selected — not uploaded yet
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {staged.map((s, i) => (
              <div key={s.preview} className="relative aspect-square overflow-hidden rounded-lg border border-ink-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.preview} alt="" className="h-full w-full object-cover" />
                {!saving && (
                  <button
                    type="button"
                    data-no-confirm-save="true"
                    onClick={() => removeAt(i)}
                    className="absolute right-1 top-1 rounded-full bg-coral-600 p-1 text-white shadow"
                    aria-label="Remove selected photo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              data-no-confirm-save="true"
              onClick={save}
              disabled={disabled || saving}
              className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {saving ? 'Uploading…' : `Save photo${staged.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
