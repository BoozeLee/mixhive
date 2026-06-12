import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '../index.css';
import '../styles/global.css';
import './mixhive.css';
import { SentryClient } from '@/components/SentryClient';
import { MixpanelClient } from '@/components/MixpanelClient';
import { Toaster } from '@/components/ui/Toaster';

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
    <html lang="en" className="mixhive-fonts">
      <body>
        <SentryClient />
        <MixpanelClient />
        <Toaster position="top-right" />
        {children}
      </body>
    </html>
  );
}
