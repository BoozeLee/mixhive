'use client';

import { StrictMode, useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import * as Sentry from '@sentry/react';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerSW } from './lib/pushSubscription';
import { useLenis } from './lib/useLenis';

let sentryReady = false;

function initSentry() {
  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!sentryDsn || sentryReady) return;
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_RELEASE_SHA,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.exception?.values?.[0]?.value?.includes('ResizeObserver loop')) return null;
      return event;
    },
  });
  sentryReady = true;
}

export default function MixHiveClient() {
  // Studio-grade smooth scroll (auto-disabled on touch + reduced-motion)
  useLenis();

  useEffect(() => {
    initSentry();
    registerSW(); // silent — no permission requested here, opt-in via bell
  }, []);

  return (
    <StrictMode>
      {/* reducedMotion="user" makes every Framer animation honor the OS setting */}
      <MotionConfig reducedMotion="user">
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </MotionConfig>
    </StrictMode>
  );
}
