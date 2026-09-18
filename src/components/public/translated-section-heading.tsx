'use client';

import { SectionHeading } from './section-heading';
import { useTranslation } from '@/lib/i18n/use-translation';
import type { TranslationKey } from '@/lib/i18n/translations';

/**
 * The homepage itself stays a Server Component (it does direct
 * Supabase data-fetching), so this small Client Component wrapper is
 * what actually reads the saved language and swaps in translated text
 * for a section heading — converting the whole page just for this
 * would be a much bigger, riskier change than wrapping just the text.
 */
export function TranslatedSectionHeading({
  eyebrowKey,
  titleKey,
}: {
  eyebrowKey?: TranslationKey;
  titleKey: TranslationKey;
}) {
  const { t } = useTranslation();
  return <SectionHeading eyebrow={eyebrowKey ? t(eyebrowKey) : undefined} title={t(titleKey)} />;
}
