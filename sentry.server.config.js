// This file configures the Sentry.io server for your Next.js application
// To learn more, see https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;
if (dsn && !/(your-|placeholder|changeme|examplePublicKey)/i.test(dsn)) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    profilesSampleRate: 0,
    sendDefaultPii: false,
    debug: false,
  });
}
