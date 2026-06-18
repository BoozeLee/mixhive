import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = dirname(fileURLToPath(import.meta.url));
const hasNextPublicSupabasePair = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
const supabaseUrl = hasNextPublicSupabasePair
  ? process.env.NEXT_PUBLIC_SUPABASE_URL
  : process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = hasNextPublicSupabasePair
  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  : process.env.VITE_SUPABASE_ANON_KEY;
const validSource = value =>
  typeof value === 'string' && value.length > 0 && !value.includes('undefined') ? value : null;
const sources = (...values) => values.map(validSource).filter(Boolean).join(' ');
const configuredOptionalValue = value =>
  typeof value === 'string' && value.length > 0 && !/(your-|placeholder|changeme)/i.test(value)
    ? value
    : undefined;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: appDir,
  turbopack: {
    root: appDir,
  },
  serverExternalPackages: ['ioredis', 'web-push'],

  // Images optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Webpack configuration
  webpack: (config, { dev, isServer, webpack }) => {
    // Add optimization for production builds
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
            },
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 5,
            },
            ui: {
              test: /[\\/]src[\\/]components[\\/]ui[\\/]/,
              name: 'ui',
              chunks: 'all',
              priority: 8,
            },
            hooks: {
              test: /[\\/]src[\\/]hooks[\\/]/,
              name: 'hooks',
              chunks: 'all',
              priority: 7,
            },
            audio: {
              test: /[\\/]src[\\/]components[\\/]audio[\\/]/,
              name: 'audio',
              chunks: 'all',
              priority: 9,
            },
          },
        },
      };
    }

    // Add loader for audio files
    config.module.rules.push({
      test: /\.(mp3|wav|flac|aac|ogg|webm)$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/media/[name].[hash][ext]',
      },
    });

    // Add loader for video files
    config.module.rules.push({
      test: /\.(mp4|webm|mov)$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/media/[name].[hash][ext]',
      },
    });

    // Add loader for fonts
    config.module.rules.push({
      test: /\.(woff|woff2|eot|ttf|otf)$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/fonts/[name].[hash][ext]',
      },
    });

    // Add performance budget
    if (!dev && !isServer) {
      config.performance = {
        ...config.performance,
        hints: 'warning',
        maxEntrypointSize: 512000, // 512KB
        maxAssetSize: 512000, // 512KB
      };
    }

    return config;
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
    NEXT_PUBLIC_SENTRY_DSN: configuredOptionalValue(
      process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.VITE_SENTRY_DSN
    ),
    NEXT_PUBLIC_RELEASE_SHA:
      process.env.NEXT_PUBLIC_RELEASE_SHA ||
      process.env.VITE_RELEASE_SHA ||
      process.env.VERCEL_GIT_COMMIT_SHA,
    NEXT_PUBLIC_CDN_BASE_URL: process.env.NEXT_PUBLIC_CDN_BASE_URL,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY:
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY,
    NEXT_PUBLIC_MIXPANEL_TOKEN: configuredOptionalValue(process.env.NEXT_PUBLIC_MIXPANEL_TOKEN),
  },

  async headers() {
    const cdnUrl = process.env.NEXT_PUBLIC_CDN_BASE_URL;
    const mediaSources = sources(
      cdnUrl,
      supabaseUrl,
      'https://*.supabase.co',
      'https://*.supabase.in'
    );
    const connectSources = sources(
      cdnUrl,
      supabaseUrl,
      'wss://*.supabase.co',
      'wss://*.supabase.in',
      'https://api-js.mixpanel.com',
      'https://api.mixpanel.com',
      'https://va.vercel-scripts.com',
      'https://vitals.vercel-insights.com'
    );

    // CDN-specific cache configuration
    // Dev only: React's dev runtime needs eval(); allow it in development so a
    // local browser can run the client app. Production CSP is unchanged.
    const scriptEval = process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : '';
    const getCdnHeaders = source => {
      return [
        {
          key: 'Content-Security-Policy',
          value: `default-src 'self'; script-src 'self' 'unsafe-inline'${scriptEval} https://va.vercel-scripts.com https://vitals.vercel-insights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${mediaSources}; media-src 'self' blob: ${mediaSources}; font-src 'self' data:; connect-src 'self' ${connectSources}; frame-ancestors 'self'; form-action 'self'; base-uri 'self'; object-src 'none'; worker-src 'self' blob:`,
        },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(self), geolocation=(), payment=(self), interest-cohort=()',
        },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
        // CDN-specific headers
        ...(cdnUrl
          ? [
              { key: 'CDN-Cache-Control', value: 'public, s-maxage=31536000, immutable' },
              { key: 'X-Content-Digest', value: 'cdn' },
            ]
          : []),
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
        source:
          '/(mix-audio|mix-artwork|mix-waveforms|profile-avatars|profile-banners|buzz-media)/(.*)',
        headers: [
          ...getCdnHeaders('/'),
          {
            key: 'Cache-Control',
            value:
              'public, max-age=31536000, immutable, s-maxage=31536000, stale-while-revalidate=86400',
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
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; img-src 'self' data: blob:;",
          },
        ],
      },
      // Embedded content headers
      {
        source: '/embed/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${mediaSources}; media-src 'self' blob: ${mediaSources}; connect-src 'self' ${connectSources}; frame-ancestors *`,
          },
          { key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=3600' },
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
    ];
  },

  // Redirects
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/feed',
        permanent: true,
      },
    ];
  },

  // Rewrites
  async rewrites() {
    return [
      {
        source: '/api/trpc/:path*',
        destination: 'http://localhost:3000/api/trpc/:path*',
      },
    ];
  },

  // Compression
  compress: true,

  // Powered by header
  poweredByHeader: false,

  // Generate ETags
  generateEtags: false,
};

export default nextConfig;
