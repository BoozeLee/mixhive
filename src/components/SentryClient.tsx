'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export function SentryClient() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (dsn && !/(your-|placeholder|changeme|examplePublicKey)/i.test(dsn)) {
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || 'development',
        release: process.env.NEXT_PUBLIC_RELEASE_SHA,
        tracesSampleRate: 0.1,
        profilesSampleRate: 0,
        sendDefaultPii: false,
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
