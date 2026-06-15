// i18n configuration (P10). MixHive is a client SPA (React Router under an
// ssr:false Next bridge), so locale is cookie/localStorage-based — not URL
// `[locale]` segments. `en` is the source of truth; other locales fall back to
// English for missing keys (see src/i18n/loadMessages.ts).

export const LOCALES = ['en', 'fr', 'nl', 'de', 'es'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'mh_locale';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  nl: 'Nederlands',
  de: 'Deutsch',
  es: 'Español',
};

function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

/** Read the persisted locale (cookie first, then localStorage). SSR-safe. */
export function getStoredLocale(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  const cookie = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${LOCALE_COOKIE}=`))
    ?.split('=')[1];
  if (isLocale(cookie)) return cookie;
  try {
    const stored = window.localStorage.getItem(LOCALE_COOKIE);
    if (isLocale(stored)) return stored;
  } catch {
    // localStorage may be unavailable (private mode); cookie/default is fine.
  }
  return DEFAULT_LOCALE;
}

/** Persist the locale to cookie (1 year) + localStorage. */
export function setStoredLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${maxAge}; samesite=lax`;
  try {
    window.localStorage.setItem(LOCALE_COOKIE, locale);
  } catch {
    // best-effort
  }
}
