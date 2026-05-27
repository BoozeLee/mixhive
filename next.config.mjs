import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: appDir,
  turbopack: {
    root: appDir,
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.VITE_SENTRY_DSN,
    NEXT_PUBLIC_RELEASE_SHA: process.env.NEXT_PUBLIC_RELEASE_SHA || process.env.VITE_RELEASE_SHA || process.env.VERCEL_GIT_COMMIT_SHA,
  },
  async headers() {
    // CDN-specific cache configuration
    const getCdnHeaders = (source: string) => {
      const cdnUrl = process.env.NEXT_PUBLIC_CDN_BASE_URL;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      
      return [
        {
          key: 'Content-Security-Policy',
          value: `default-src 'self'; script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://vitals.vercel-insights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${cdnUrl} ${supabaseUrl} https://*.supabase.co https://*.supabase.in; media-src 'self' blob: ${cdnUrl} ${supabaseUrl} https://*.supabase.co https://*.supabase.in; font-src 'self' data:; connect-src 'self' ${cdnUrl} ${supabaseUrl} wss://*.supabase.co wss://*.supabase.in https://va.vercel-scripts.com https://vitals.vercel-insights.com; frame-ancestors 'self'; form-action 'self'; base-uri 'self'; object-src 'none'; worker-src 'self' blob:`,
        },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self), interest-cohort=()' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
        // CDN-specific headers
        ...(cdnUrl ? [
          { key: 'CDN-Cache-Control', value: 'public, s-maxage=31536000, immutable' },
          { key: 'X-Content-Digest', value: 'cdn' },
        ] : []),
      ];
    };

    return [
      // Global headers with CDN support
      {
        source: '/(.*)',
        headers: getCdnHeaders('/'),
      },
      // Media file headers with optimized caching
      {
        source: '/(mix-audio|mix-artwork|mix-waveforms|profile-avatars|profile-banners|buzz-media)/(.*)',
        headers: [
          ...getCdnHeaders('/'),
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable, s-maxage=31536000, stale-while-revalidate=86400',
          },
          { key: 'CDN-Cache-Tag', value: 'media,cdn' },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
      // Image optimization headers
      {
        source: '/(mix-artwork|profile-avatars|profile-banners)/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable, s-maxage=31536000',
          },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Vary', value: 'Accept-Encoding' },
        ],
      },
      // Audio file headers
      {
        source: '/(mix-audio|buzz-media)/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable, s-maxage=31536000',
          },
          { key: 'Accept-Ranges', value: 'bytes' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      // Waveform file headers
      {
        source: '/mix-waveforms/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          { key: 'Content-Security-Policy', value: "default-src 'self'; img-src 'self' data: blob:;" },
        ],
      },
      // Embedded content headers
      {
        source: '/embed/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${cdnUrl} ${supabaseUrl}; media-src 'self' blob: ${cdnUrl} ${supabaseUrl}; connect-src 'self' ${cdnUrl} ${supabaseUrl}; frame-ancestors *",
          },
          { key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=3600' },
        ],
      },
      // Static assets headers
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'CDN-Cache-Control', value: 'public, s-maxage=31536000, immutable' },
        ],
      },
      // API endpoints headers
      {
        source: '/api/(health|websocket|cdn)/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      // CDN health check headers
      {
        source: '/cdn-health',
        headers: [
          { key: 'Cache-Control', value: 'no-cache' },
          { key: 'Content-Type', value: 'application/json' },
          { key: 'X-CDN-Health', value: 'enabled' },
        ],
      },
    ]
  },
}

export default nextConfig
