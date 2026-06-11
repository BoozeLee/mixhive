'use client';

import { useEffect } from 'react';

export function MixpanelClient() {
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
    // Skip init when no token is configured so dev/placeholder builds stay quiet.
    if (!token) return;

    let cleanup: (() => void) | undefined;

    // Dynamic import keeps mixpanel-browser (≈600 kB) out of the initial bundle;
    // it only loads once, after first paint, when analytics is actually enabled.
    void import('mixpanel-browser').then(({ default: mixpanel }) => {
      mixpanel.init(token, {
        debug: process.env.NODE_ENV === 'development',
        persistence: 'localStorage',
        opt_out_tracking_by_default: false,
      });

      const userId =
        typeof window !== 'undefined' ? localStorage.getItem('mixpanel_user_id') : null;
      if (userId) {
        mixpanel.identify(userId);
      }

      const trackPageView = () => {
        mixpanel.track('Page View', {
          page: window.location.pathname,
          title: document.title,
          url: window.location.href,
        });
      };

      trackPageView();

      const handleRouteChange = () => trackPageView();
      window.addEventListener('popstate', handleRouteChange);
      cleanup = () => window.removeEventListener('popstate', handleRouteChange);
    });

    return () => cleanup?.();
  }, []);

  return null;
}
