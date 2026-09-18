'use client';

import { useState, useEffect, useCallback } from 'react';
import { translations, type SupportedLanguage, type TranslationKey } from './translations';

const STORAGE_KEY = 'preferred_language';
const CHANGE_EVENT = 'language-changed';

/** Reads the currently saved language, defaulting to English. */
export function getSavedLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'hi' || stored === 'ml' ? stored : 'en';
}

/** Saves a new language choice and notifies every mounted useTranslation() hook. */
export function setSavedLanguage(lang: SupportedLanguage) {
  window.localStorage.setItem(STORAGE_KEY, lang);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: lang }));
}

/**
 * Gives components a t(key) function that returns the current
 * language's text for that key, re-rendering automatically whenever
 * the language changes anywhere on the page (via the LanguagePicker),
 * without needing a page reload or a URL-based locale segment.
 */
export function useTranslation() {
  const [lang, setLang] = useState<SupportedLanguage>('en');

  useEffect(() => {
    setLang(getSavedLanguage());
    function onChange(e: Event) {
      setLang((e as CustomEvent<SupportedLanguage>).detail);
    }
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translations[lang]?.[key] ?? translations.en[key],
    [lang]
  );

  return { t, lang };
}
