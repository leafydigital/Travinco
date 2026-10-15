'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { X, Plus, ArrowUp, ArrowDown, Play } from 'lucide-react';
import { addPackageVideo, removePackageVideo, reorderPackageVideo } from '../sub-resource-actions';
import { getVideoEmbedUrl } from '@/lib/utils/format';
import type { Tables } from '@/types/database';

export function PackageVideosManager({
  packageId,
  videos,
}: {
  packageId: string;
  videos: Tables<'package_videos'>[];
}) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [isPending, startTransition] = useTransition();

  function add() {
    if (!url.trim()) return;
    startTransition(async () => {
      const result = await addPackageVideo(packageId, url.trim());
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setUrl('');
      toast.success('Video added');
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await removePackageVideo(packageId, id);
      if (result.error) toast.error(result.error);
      router.refresh();
    });
  }

  function move(id: string, direction: 'up' | 'down') {
    startTransition(async () => {
      const result = await reorderPackageVideo(packageId, id, direction);
      if (result.error) toast.error(result.error);
      router.refresh();
    });
  }

  const sorted = [...videos].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-400">
        Add as many YouTube or Vimeo links as you like — each one plays inline on the package
        page, the visitor never leaves the site. Use the arrows to change the order they appear
        in.
      </p>

      {sorted.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {sorted.map((video, i) => {
            const embedUrl = getVideoEmbedUrl(video.video_url);
            return (
              <div key={video.id} className="rounded-lg border border-ink-100 p-2">
                <div className="relative aspect-video overflow-hidden rounded-md bg-ink-100">
                  {embedUrl ? (
                    <iframe
                      src={embedUrl}
                      title={`Video ${i + 1}`}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-ink-400">
                      <Play className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => move(video.id, 'up')}
                      disabled={isPending || i === 0}
                      className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 disabled:opacity-40"
                      aria-label="Move earlier"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(video.id, 'down')}
                      disabled={isPending || i === sorted.length - 1}
                      className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 disabled:opacity-40"
                      aria-label="Move later"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(video.id)}
                    disabled={isPending}
                    className="rounded-lg p-1.5 text-coral-600 hover:bg-coral-50"
                    aria-label="Remove video"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          className="input flex-1 min-w-[220px]"
        />
        <button type="button" onClick={add} disabled={isPending} className="btn-outline">
          <Plus className="h-4 w-4" /> Add video
        </button>
      </div>
    </div>
  );
}
