// This file configures the Sentry.io client for your Next.js application
// To learn more, see https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://examplePublicKey@o0.ingest.sentry.io/0",

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  tracesSampleRate: 1.0,

  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: 1.0,

  // Adjust this value in production, or use tracesSampler for control
  // samplingRate: 0.1,

  // An array of strings that represent URLs to ignore during performance monitoring
  // ignoreTransactions: ["/(api|_next/static|_next/image|favicon.ico).*"],

  // Alternatively, you can use a function to filter out transactions
  // ignoreTransactions: [
  //   ({ request }) => request.url.includes('/api/health'),
  // ],

  // Setting this option to true will print useful information to the console
  // while you're setting up Sentry.
  debug: false,

  // Integrate with Next.js routing
  integrations: [
    Sentry.initRoutingInstrumentation({
      customAppCreateHandler: (app) => {
        // This is a custom handler for Next.js App Router
        return app;
      },
    }),
  ],

  // Set profilesSampleRate to 1.0 to capture 100%
  // of profiles for performance monitoring.
  // We recommend adjusting this value in production
  profilesSampleRate: 1.0,
});