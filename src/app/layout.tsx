import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Permanent_Marker, Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import '../index.css'
import '../styles/global.css'
import './mixhive.css'

// MIXHIVE brand faces — served self-hosted via next/font, so the Vite-side SPA
// inside <App> picks them up too without an extra CDN round-trip.
const displayFont = Permanent_Marker({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
})

const uiFont = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ui',
  display: 'swap',
})

const monoFont = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MIXHIVE — The Hive Never Sleeps',
  description: 'The internet’s first music hive city for DJs, producers, rave organizers, visual artists, and underground culture creators.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon-180x180.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#f6c400',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${uiFont.variable} ${monoFont.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
