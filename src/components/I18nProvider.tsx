'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import en from '../../messages/en.json';
import { DEFAULT_LOCALE, getStoredLocale, setStoredLocale, type Locale } from '../i18n/config';
import { loadMessages } from '../i18n/loadMessages';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
});

/** Read/change the active locale from anywhere in the React Router tree. */
export function useLocaleSwitcher(): LocaleContextValue {
  return useContext(LocaleContext);
}

/**
 * Client i18n provider for the SPA. Holds the active locale (cookie-backed),
 * lazy-loads its message catalog (English bundled synchronously as the fallback
 * base), and exposes `useLocaleSwitcher()` for the language switcher.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [messages, setMessages] = useState<AbstractIntlMessages>(en as AbstractIntlMessages);

  // Resolve the stored locale on mount (cookie/localStorage are client-only).
  useEffect(() => {
    const stored = getStoredLocale();
    if (stored !== DEFAULT_LOCALE) {
      loadMessages(stored).then(m => {
        setMessages(m);
        setLocaleState(stored);
      });
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setStoredLocale(next);
    loadMessages(next).then(m => {
      setMessages(m);
      setLocaleState(next);
    });
  }, []);

  const ctx = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <LocaleContext.Provider value={ctx}>
      <NextIntlClientProvider
        locale={locale}
        messages={messages}
        // The app is a single-timezone UI; pin to UTC to avoid hydration noise.
        timeZone="UTC"
        onError={() => {
          // Missing keys fall back to English via the merged catalog; don't spam.
        }}
      >
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
