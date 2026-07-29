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
        <a
          href="#main-content"
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0,0,0,0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
          onFocus={e => {
            e.currentTarget.style.position = 'fixed';
            e.currentTarget.style.width = 'auto';
            e.currentTarget.style.height = 'auto';
            e.currentTarget.style.padding = '8px 16px';
            e.currentTarget.style.margin = 0;
            e.currentTarget.style.clip = 'auto';
            e.currentTarget.style.background = colors.accent;
            e.currentTarget.style.color = colors.black;
            e.currentTarget.style.top = 0;
            e.currentTarget.style.left = 0;
            e.currentTarget.style.zIndex = 9999;
            e.currentTarget.style.fontSize = '14px';
            e.currentTarget.style.fontWeight = 700;
            e.currentTarget.style.outline = 'none';
            e.currentTarget.style.textDecoration = 'none';
          }}
          onBlur={e => {
            e.currentTarget.style.position = 'absolute';
            e.currentTarget.style.width = 1;
            e.currentTarget.style.height = 1;
            e.currentTarget.style.padding = 0;
            e.currentTarget.style.margin = -1;
            e.currentTarget.style.clip = 'rect(0,0,0,0)';
          }}
        >
          Skip to content
        </a>
        <div id="main-content" />
        {children}
      </body>
    </html>
  );
}
