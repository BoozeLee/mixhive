'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export function SentryClient() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 1.0,
        profilesSampleRate: 1.0,
        beforeSend(event) {
          // Drop noise we don't care about
          if (event.exception?.values?.[0]?.value?.includes('ResizeObserver loop')) {
            return null;
          }
          return event;
        },
      });
    }
  }, []);

  return null;
}