'use client';

import { useTranslation } from '@/lib/i18n/use-translation';

export function TranslatedCta() {
  const { t } = useTranslation();
  return (
    <>
      <h2 className="font-display text-2xl font-semibold sm:text-3xl">{t('home_cta_title')}</h2>
      <p className="mx-auto mt-2 max-w-md text-white/80">{t('home_cta_body')}</p>
    </>
  );
}
