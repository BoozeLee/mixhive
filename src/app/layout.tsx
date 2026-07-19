import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import '../index.css';
import '../styles/global.css';
import './mixhive.css';
import { SentryClient } from '@/components/SentryClient';
import { MixpanelClient } from '@/components/MixpanelClient';
import { Toaster } from '@/components/ui/Toaster';
import { LOCALE_COOKIE, DEFAULT_LOCALE, type Locale } from '@/i18n/config';

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
  themeColor: '#f6c400',
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
    <html lang={lang} className="mixhive-fonts">
      <body>
        <SentryClient />
        <MixpanelClient />
        <Toaster position="top-right" />
        {children}
      </body>
    </html>
  );
}
