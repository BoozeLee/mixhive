import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import localFont from 'next/font/local';
import '../index.css';
import '../styles/global.css';
import './mixhive.css';
import { SentryClient } from '@/components/SentryClient';
import { MixpanelClient } from '@/components/MixpanelClient';
import { Toaster } from '@/components/ui/Toaster';
import { LOCALE_COOKIE, DEFAULT_LOCALE, type Locale } from '@/i18n/config';
import { colors } from '@/styles/tokens';

// Display face for hero and section headlines, self-hosted so there is no
// third-party dependency at build or run time — the woff2 is committed at
// src/app/fonts and next/font serves it from our own origin. It replaces the
// Impact system stack that read as the page's most amateur signal. The subset
// carries Latin-1 + Latin Extended-A, so accented headings in fr/nl/de/es
// render as glyphs, not tofu. `--font-anton` is consumed by --font-display in
// mixhive.css; `adjustFontFallback` size-matches the fallback to avoid layout
// shift before the woff2 loads.
const anton = localFont({
  src: './fonts/anton-subset.woff2',
  weight: '400',
  style: 'normal',
  display: 'swap',
  variable: '--font-anton',
  adjustFontFallback: 'Arial',
});

const LOCALES = ['en', 'fr', 'nl', 'de', 'es'] as readonly string[];

export const metadata: Metadata = {
  title: 'MIXHIVE — The Hive Never Sleeps',
  description:
    "The internet's first music hive city for DJs, producers, rave organizers, visual artists, and underground culture creators.",
  manifest: '/manifest.json',
  icons: {
    icon: '/mixhive.png',
    apple: '/mixhive.png',
  },
};

export const viewport: Viewport = {
  themeColor: colors.accentBright,
  colorScheme: 'dark',
};

async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  if (raw && LOCALES.includes(raw)) return raw as Locale;
  return DEFAULT_LOCALE;
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const lang = await getLocale();
  return (
    <html lang={lang} className={`mixhive-fonts ${anton.variable}`}>
      <body>
        <SentryClient />
        <MixpanelClient />
        <Toaster position="top-right" />
        {children}
      </body>
    </html>
  );
}
