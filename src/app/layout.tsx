import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Space_Grotesk, JetBrains_Mono, Anton } from 'next/font/google';
import '../index.css';
import '../styles/global.css';
import './mixhive.css';
import { SentryClient } from '@/components/SentryClient';
import { MixpanelClient } from '@/components/MixpanelClient';
import { Toaster } from '@/components/ui/Toaster';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-ui',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

// Anton — condensed heavy display face for cinematic festival-poster headlines.
const anton = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-anton',
  display: 'swap',
});

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${anton.variable} mixhive-fonts`}
    >
      <body>
        <SentryClient />
        <MixpanelClient />
        <Toaster position="top-right" />
        {children}
      </body>
    </html>
  );
}
