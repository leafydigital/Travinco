'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import { toast } from '@/lib/admin-alert';

type SaveFn = () => Promise<{ error?: string } | void>;
type Registry = { register: (key: string, fn: () => SaveFn) => () => void };

const SettingsSaveContext = createContext<Registry | null>(null);

/**
 * The Settings page has one Save button (sticky at the top) that saves every
 * section. Each section registers its own save function with this provider.
 */
export function SettingsSaveProvider({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const sections = useRef(new Map<string, () => SaveFn>());

  const register = useCallback((key: string, fn: () => SaveFn) => {
    sections.current.set(key, fn);
    return () => void sections.current.delete(key);
  }, []);

  function saveAll() {
    start(async () => {
      const results = await Promise.all(
        Array.from(sections.current.values()).map((get) =>
          get()().catch(() => ({ error: 'Could not save settings. Please try again.' }))
        )
      );
      const error = results.find((r) => r && r.error)?.error;
      if (error) return void toast.error(error);
      toast.success('Settings saved');
      router.refresh();
    });
  }

  return (
    <SettingsSaveContext.Provider value={{ register }}>
      <div className="sticky top-14 z-30 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:top-16 lg:top-2">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">{title}</h1>
          {subtitle && <p className="text-sm text-ink-500">{subtitle}</p>}
        </div>
        <button type="button" onClick={saveAll} disabled={pending} className="btn-primary">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {pending ? 'Saving…' : 'Save settings'}
        </button>
      </div>
      {children}
    </SettingsSaveContext.Provider>
  );
}

/** Registers a section's save function; the latest render's function is always used. */
export function useRegisterSettingsSave(key: string, save: SaveFn) {
  const ctx = useContext(SettingsSaveContext);
  const latest = useRef(save);
  latest.current = save;
  useEffect(() => ctx?.register(key, () => latest.current), [ctx, key]);
}
