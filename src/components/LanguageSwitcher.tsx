'use client';

import { useTranslations } from 'next-intl';
import { Select } from './ui/Select';
import { LOCALES, LOCALE_LABELS, type Locale } from '../i18n/config';
import { useLocaleSwitcher } from './I18nProvider';

/** Language picker backed by the cookie-based locale store. */
export function LanguageSwitcher({ hideLabel = false }: { hideLabel?: boolean }) {
  const { locale, setLocale } = useLocaleSwitcher();
  const t = useTranslations('common');

  return (
    <Select
      label={t('language')}
      hideLabel={hideLabel}
      value={locale}
      onChange={e => setLocale(e.target.value as Locale)}
      options={LOCALES.map(l => ({ value: l, label: LOCALE_LABELS[l] }))}
    />
  );
}
