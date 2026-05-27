'use client'

import { StrictMode, useEffect } from 'react'
import * as Sentry from '@sentry/react'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'

let sentryReady = false

function initSentry() {
  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!sentryDsn || sentryReady) return
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_RELEASE_SHA,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.exception?.values?.[0]?.value?.includes('ResizeObserver loop')) return null
      return event
    },
  })
  sentryReady = true
}

export default function MixHiveClient() {
  useEffect(() => {
    initSentry()
  }, [])

  return (
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  )
}
