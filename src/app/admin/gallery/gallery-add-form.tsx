'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { addGalleryImage } from '../content-actions';
import { uploadGalleryImage } from './upload-actions';

const NEW_VALUE = '__new__';

export function GalleryAddForm({
  existingCountries,
  existingCategories,
}: {
  existingCountries: string[];
  existingCategories: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);

  const [countryChoice, setCountryChoice] = useState(existingCountries[0] ?? NEW_VALUE);
  const [newCountry, setNewCountry] = useState('');
  const [categoryChoice, setCategoryChoice] = useState(NEW_VALUE);
  const [newCategory, setNewCategory] = useState('');
  const [title, setTitle] = useState('');

  const country = countryChoice === NEW_VALUE ? newCountry : countryChoice;
  const category = categoryChoice === NEW_VALUE ? newCategory : categoryChoice;

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (!country.trim() || !category.trim()) {
      toast.error('Choose or type a country and a place before adding images.');
      e.target.value = '';
      return;
    }
    setIsUploading(true);
    const newUrls: string[] = [];
    for (const file of files) {
      const formData = new FormData();
      formData.set('file', file);
      const result = await uploadGalleryImage(formData);
      if (result.error) {
        toast.error(`${file.name}: ${result.error}`);
      } else if (result.url) {
        newUrls.push(result.url);
      }
    }
    setIsUploading(false);
    e.target.value = '';

    if (newUrls.length === 0) return;

    // Save each uploaded image into this country/place folder right
    // away — no separate "confirm" step, since the upload itself is
    // the intent.
    startTransition(async () => {
      let savedCount = 0;
      for (const url of newUrls) {
        const result = await addGalleryImage(url, title, country, category);
        if (result.error) {
          toast.error(result.error);
        } else {
          savedCount += 1;
        }
      }
      if (savedCount > 0) {
        toast.success(savedCount === 1 ? 'Image added' : `${savedCount} images added`);
        setTitle('');
        router.refresh();
      }
    });
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Country (main folder)</label>
          <select
            value={countryChoice}
            onChange={(e) => setCountryChoice(e.target.value)}
            className="input"
          >
            {existingCountries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={NEW_VALUE}>+ New country…</option>
          </select>
          {countryChoice === NEW_VALUE && (
            <input
              value={newCountry}
              onChange={(e) => setNewCountry(e.target.value)}
              placeholder="e.g. India"
              className="input mt-2"
              autoFocus
            />
          )}
        </div>

        <div>
          <label className="label">Place (subfolder)</label>
          <select
            value={categoryChoice}
            onChange={(e) => setCategoryChoice(e.target.value)}
            className="input"
          >
            <option value={NEW_VALUE}>+ New place…</option>
            {existingCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {categoryChoice === NEW_VALUE && (
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="e.g. Munnar, Goa, Ooty…"
              className="input mt-2"
              autoFocus
            />
          )}
        </div>

        <div>
          <label className="label">Title (optional, applies to this batch)</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Optional caption"
            className="input"
          />
        </div>
      </div>

      <p className="text-xs text-ink-400">
        Images are organized as Country → Place, like folders — e.g. India → Munnar.{' '}
        <strong>To add more photos to a folder you already have</strong>, just pick that same
        country and place from the dropdowns above (don&apos;t choose &quot;+ New&quot;) and
        upload — they&apos;ll join that same existing folder.
      </p>

      <div>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileSelect}
          disabled={isUploading || isPending}
          className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
        />
        {(isUploading || isPending) && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-brand-600">
            <Plus className="h-3 w-3 animate-pulse" /> {isUploading ? 'Uploading…' : 'Saving…'}
          </p>
        )}
      </div>
    </div>
  );
}
