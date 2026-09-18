'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Image from 'next/image';
import { Trash2, ImageOff, Folder, FolderOpen, ChevronDown, Pencil, X, Check } from 'lucide-react';
import {
  setGalleryImageStatus,
  deleteGalleryImage,
  renameGalleryFolder,
  deleteGalleryFolder,
} from '../content-actions';
import type { Tables, ContentStatus } from '@/types/database';

export function GalleryGrid({ images }: { images: Tables<'gallery'>[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [collapsedCountries, setCollapsedCountries] = useState<Set<string>>(new Set());
  const [collapsedPlaces, setCollapsedPlaces] = useState<Set<string>>(new Set());
  const [renamingCountry, setRenamingCountry] = useState<string | null>(null);
  const [renamingPlace, setRenamingPlace] = useState<string | null>(null); // "country::place"
  const [renameValue, setRenameValue] = useState('');

  function toggleStatus(id: string, current: ContentStatus) {
    const next: ContentStatus = current === 'published' ? 'draft' : 'published';
    startTransition(async () => {
      const result = await setGalleryImageStatus(id, next);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm('Delete this image?')) return;
    startTransition(async () => {
      const result = await deleteGalleryImage(id);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  }

  function toggleCountry(country: string) {
    setCollapsedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(country)) next.delete(country);
      else next.add(country);
      return next;
    });
  }

  function togglePlace(key: string) {
    setCollapsedPlaces((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function startRenameCountry(country: string) {
    setRenamingCountry(country);
    setRenameValue(country);
  }

  function confirmRenameCountry(oldCountry: string, samplePlace: string) {
    if (!renameValue.trim() || renameValue === oldCountry) {
      setRenamingCountry(null);
      return;
    }
    startTransition(async () => {
      const result = await renameGalleryFolder(oldCountry, samplePlace, renameValue.trim(), samplePlace);
      if (result.error) toast.error(result.error);
      else {
        toast.success('Country renamed');
        router.refresh();
      }
      setRenamingCountry(null);
    });
  }

  function startRenamePlace(key: string, place: string) {
    setRenamingPlace(key);
    setRenameValue(place);
  }

  function confirmRenamePlace(country: string, oldPlace: string) {
    if (!renameValue.trim() || renameValue === oldPlace) {
      setRenamingPlace(null);
      return;
    }
    startTransition(async () => {
      const result = await renameGalleryFolder(country, oldPlace, country, renameValue.trim());
      if (result.error) toast.error(result.error);
      else {
        toast.success('Place renamed');
        router.refresh();
      }
      setRenamingPlace(null);
    });
  }

  function removeCountryFolder(country: string, totalImages: number) {
    if (!confirm(`Delete all ${totalImages} photo(s) under "${country}"? This cannot be undone.`)) return;
    startTransition(async () => {
      // Country-wide delete: remove every place inside it one at a time,
      // since deleteGalleryFolder targets a single country+place pair.
      const supabaseGroupsToDelete = images
        .filter((img) => (img.country ?? 'Uncategorized') === country)
        .map((img) => img.category ?? 'Uncategorized');
      const uniquePlaces = Array.from(new Set(supabaseGroupsToDelete));
      let hadError = false;
      for (const place of uniquePlaces) {
        const result = await deleteGalleryFolder(country, place);
        if (result.error) hadError = true;
      }
      if (hadError) toast.error('Some photos could not be deleted.');
      else toast.success('Folder deleted');
      router.refresh();
    });
  }

  function removePlaceFolder(country: string, place: string, count: number) {
    if (!confirm(`Delete all ${count} photo(s) under "${place}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteGalleryFolder(country, place);
      if (result.error) toast.error(result.error);
      else {
        toast.success('Folder deleted');
        router.refresh();
      }
    });
  }

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl2 border border-dashed border-ink-200 py-14 text-center">
        <div className="rounded-full bg-ink-50 p-3">
          <ImageOff className="h-5 w-5 text-ink-300" />
        </div>
        <p className="mt-3 text-sm font-medium text-ink-600">No gallery images yet</p>
        <p className="mt-1 text-xs text-ink-400">Add your first image using the form above.</p>
      </div>
    );
  }

  // Two-level grouping: country is the outer folder, category (place) is
  // the inner folder — e.g. India -> Munnar, India -> Goa. Images with no
  // country/place land in shared "Uncategorized" groups at the end.
  const byCountry = new Map<string, Map<string, Tables<'gallery'>[]>>();
  for (const img of images) {
    const countryKey = img.country ?? 'Uncategorized';
    const placeKey = img.category ?? 'Uncategorized';
    if (!byCountry.has(countryKey)) byCountry.set(countryKey, new Map());
    const places = byCountry.get(countryKey)!;
    if (!places.has(placeKey)) places.set(placeKey, []);
    places.get(placeKey)!.push(img);
  }

  const sortedCountries = [...byCountry.keys()].sort((a, b) => {
    if (a === 'Uncategorized') return 1;
    if (b === 'Uncategorized') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-6">
      {sortedCountries.map((country) => {
        const places = byCountry.get(country)!;
        const countryCollapsed = collapsedCountries.has(country);
        const totalInCountry = [...places.values()].reduce((sum, arr) => sum + arr.length, 0);
        const sortedPlaces = [...places.keys()].sort((a, b) => {
          if (a === 'Uncategorized') return 1;
          if (b === 'Uncategorized') return -1;
          return a.localeCompare(b);
        });
        const firstPlace = sortedPlaces[0];

        return (
          <div key={country} className="rounded-xl2 border border-ink-100 p-4">
            <div className="flex items-center justify-between gap-2">
              {renamingCountry === country ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="input flex-1"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => firstPlace && confirmRenameCountry(country, firstPlace)}
                    disabled={isPending || !firstPlace}
                    className="rounded-lg p-1.5 text-brand-600 hover:bg-brand-50"
                    aria-label="Save"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingCountry(null)}
                    className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50"
                    aria-label="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => toggleCountry(country)}
                    className="flex items-center gap-2 text-base font-semibold text-ink-900"
                  >
                    {countryCollapsed ? (
                      <Folder className="h-5 w-5 text-brand-600" />
                    ) : (
                      <FolderOpen className="h-5 w-5 text-brand-600" />
                    )}
                    {country}
                    <span className="text-xs font-normal text-ink-400">({totalInCountry})</span>
                    <ChevronDown className={`h-4 w-4 text-ink-400 transition-transform ${countryCollapsed ? '-rotate-90' : ''}`} />
                  </button>
                  {country !== 'Uncategorized' && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => startRenameCountry(country)}
                        className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
                        aria-label="Rename country"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCountryFolder(country, totalInCountry)}
                        disabled={isPending}
                        className="rounded-lg p-1.5 text-coral-500 hover:bg-coral-50"
                        aria-label="Delete country folder"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {!countryCollapsed && (
              <div className="mt-4 space-y-5 pl-2">
                {sortedPlaces.map((place) => {
                  const placeImages = places.get(place)!;
                  const placeKey = `${country}::${place}`;
                  const placeCollapsed = collapsedPlaces.has(placeKey);
                  return (
                    <div key={placeKey}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        {renamingPlace === placeKey ? (
                          <div className="flex flex-1 items-center gap-2">
                            <input
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              className="input flex-1"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => confirmRenamePlace(country, place)}
                              disabled={isPending}
                              className="rounded-lg p-1.5 text-brand-600 hover:bg-brand-50"
                              aria-label="Save"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setRenamingPlace(null)}
                              className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50"
                              aria-label="Cancel"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => togglePlace(placeKey)}
                              className="flex items-center gap-2 text-sm font-semibold text-ink-700"
                            >
                              <Folder className="h-3.5 w-3.5 text-sand-600" />
                              {place}
                              <span className="text-xs font-normal text-ink-400">({placeImages.length})</span>
                              <ChevronDown className={`h-3 w-3 text-ink-400 transition-transform ${placeCollapsed ? '-rotate-90' : ''}`} />
                            </button>
                            {place !== 'Uncategorized' && (
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => startRenamePlace(placeKey, place)}
                                  className="rounded-lg p-1 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
                                  aria-label="Rename place"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removePlaceFolder(country, place, placeImages.length)}
                                  disabled={isPending}
                                  className="rounded-lg p-1 text-coral-500 hover:bg-coral-50"
                                  aria-label="Delete place folder"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {!placeCollapsed && (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                          {placeImages.map((img) => (
                            <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl2 border border-ink-100">
                              <Image src={img.image_url} alt={img.title ?? ''} fill className="object-cover" unoptimized />
                              <div className="absolute inset-0 flex flex-col justify-between bg-black/0 p-2 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
                                <div className="flex justify-end">
                                  <button
                                    onClick={() => remove(img.id)}
                                    disabled={isPending}
                                    className="rounded-full bg-white/90 p-1.5 text-red-600"
                                    aria-label="Delete image"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <button
                                  onClick={() => toggleStatus(img.id, img.status)}
                                  disabled={isPending}
                                  className="rounded-lg bg-white/90 px-2 py-1 text-xs font-medium text-ink-700"
                                >
                                  {img.status === 'published' ? 'Unpublish' : 'Publish'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
