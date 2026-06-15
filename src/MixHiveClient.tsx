'use client';

import { StrictMode, useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { I18nProvider } from './components/I18nProvider';
import { registerSW } from './lib/pushSubscription';
import { useLenis } from './lib/useLenis';

export default function MixHiveClient() {
  // Studio-grade smooth scroll (auto-disabled on touch + reduced-motion)
  useLenis();

  useEffect(() => {
    registerSW(); // silent — no permission requested here, opt-in via bell
  }, []);

  return (
    <StrictMode>
      {/* reducedMotion="user" makes every Framer animation honor the OS setting */}
      <MotionConfig reducedMotion="user">
        <ErrorBoundary>
          <I18nProvider>
            <App />
          </I18nProvider>
        </ErrorBoundary>
      </MotionConfig>
    </StrictMode>
  );
}
