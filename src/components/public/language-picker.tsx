'use client';

import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { getSavedLanguage, setSavedLanguage } from '@/lib/i18n/use-translation';
import type { SupportedLanguage } from '@/lib/i18n/translations';

// Fully translated and live right now.
const AVAILABLE_LANGUAGES: { code: SupportedLanguage; label: string; short: string }[] = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'hi', label: 'हिन्दी (Hindi)', short: 'हि' },
  { code: 'ml', label: 'മലയാളം (Malayalam)', short: 'മല' },
];

// Listed so visitors can see more are planned, but picking one has no
// effect yet — translation for these hasn't been written.
const COMING_SOON_LANGUAGES = [
  'தமிழ் (Tamil)', 'తెలుగు (Telugu)', 'ಕನ್ನಡ (Kannada)', 'मराठी (Marathi)',
  'বাংলা (Bengali)', 'ગુજરાતી (Gujarati)', 'ਪੰਜਾਬੀ (Punjabi)', 'اردو (Urdu)',
  'العربية (Arabic)', 'Français (French)', 'Deutsch (German)', 'Español (Spanish)',
  '中文 (Chinese)', '日本語 (Japanese)', 'Русский (Russian)',
];

export function LanguagePicker({ overlayMode }: { overlayMode?: boolean }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SupportedLanguage>('en');

  useEffect(() => {
    setSelected(getSavedLanguage());
  }, []);

  function choose(code: SupportedLanguage) {
    setSelected(code);
    setSavedLanguage(code);
    setOpen(false);
  }

  const currentShort = AVAILABLE_LANGUAGES.find((l) => l.code === selected)?.short ?? 'EN';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
          overlayMode
            ? 'border-white/30 text-white hover:bg-white/10'
            : 'border-ink-200 text-ink-600 hover:bg-ink-50'
        )}
        aria-label="Choose language"
      >
        {currentShort}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-2 max-h-80 w-56 overflow-y-auto rounded-xl2 border border-ink-100 bg-white p-1.5 shadow-lg">
            {AVAILABLE_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => choose(lang.code)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-ink-700 hover:bg-ink-50"
              >
                {lang.label}
                {selected === lang.code && <Check className="h-3.5 w-3.5 text-brand-600" />}
              </button>
            ))}
            <div className="my-1 border-t border-ink-100" />
            <p className="px-3 py-1 text-xs font-medium uppercase tracking-wide text-ink-400">
              Coming soon
            </p>
            {COMING_SOON_LANGUAGES.map((label) => (
              <span
                key={label}
                className="block cursor-not-allowed px-3 py-2 text-left text-sm text-ink-300"
              >
                {label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
