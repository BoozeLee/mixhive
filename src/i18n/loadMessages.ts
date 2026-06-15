import type { AbstractIntlMessages } from 'next-intl';
import en from '../../messages/en.json';
import type { Locale } from './config';
import { DEFAULT_LOCALE } from './config';

// `en` is bundled synchronously as the fallback base so there's never a flash of
// missing keys; other locales are code-split and merged on top.
const loaders: Record<Exclude<Locale, 'en'>, () => Promise<{ default: AbstractIntlMessages }>> = {
  fr: () => import('../../messages/fr.json'),
  nl: () => import('../../messages/nl.json'),
  de: () => import('../../messages/de.json'),
  es: () => import('../../messages/es.json'),
};

function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Record<string, unknown>
): T {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = out[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === 'object'
    ) {
      out[key] = deepMerge(existing as Record<string, unknown>, value as Record<string, unknown>);
    } else if (value !== undefined && value !== '') {
      out[key] = value;
    }
  }
  return out as T;
}

/**
 * Load messages for `locale`, merged over English so any missing key falls back
 * to the English source of truth.
 */
export async function loadMessages(locale: Locale): Promise<AbstractIntlMessages> {
  const base = en as AbstractIntlMessages;
  if (locale === DEFAULT_LOCALE) return base;
  try {
    const mod = await loaders[locale as Exclude<Locale, 'en'>]();
    return deepMerge(
      base as Record<string, unknown>,
      mod.default as Record<string, unknown>
    ) as AbstractIntlMessages;
  } catch {
    return base;
  }
}
