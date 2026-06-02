import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { visualizer } from 'rollup-plugin-visualizer';

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT;
const sentryEnabled = Boolean(sentryAuthToken && sentryOrg && sentryProject);

const isAnalyze = process.env.ANALYZE === 'true';

export default defineConfig({
  plugins: [
    react(),
    // Upload source maps on production builds, only when CI provides the
    // Sentry creds — keeps local builds fast and unauthenticated.
    sentryEnabled &&
      sentryVitePlugin({
        org: sentryOrg!,
        project: sentryProject!,
        authToken: sentryAuthToken!,
        release: {
          name: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA,
        },
        sourcemaps: { assets: './dist/**' },
      }),
    isAnalyze &&
      visualizer({
        filename: 'dist/bundle-stats.html',
        template: 'treemap',
        gzipSize: true,
        brotliSize: true,
        open: true,
      }),
  ].filter(Boolean),
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 600,
  },
});
