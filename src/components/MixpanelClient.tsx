'use client';

import { useEffect } from 'react';
import { CONSENT_CHANGED_EVENT } from '../lib/consent';
import {
  identifyAnalyticsUser,
  syncAnalyticsConsent,
  trackProductEvent,
} from '../lib/productAnalytics';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export function MixpanelClient() {
  useEffect(() => {
    const pageView = () =>
      void trackProductEvent('Page Viewed', {
        path: window.location.pathname,
        route_group: window.location.pathname.split('/')[1] || 'home',
      });
    const interaction = (event: MouseEvent) => {
      const element = (event.target as Element | null)?.closest<HTMLElement>(
        'button, a[href], [data-analytics-event]'
      );
      if (!element) return;
      const href = element instanceof HTMLAnchorElement ? element.pathname : null;
      void trackProductEvent(element.dataset.analyticsEvent || 'UI Interaction', {
        element: element.tagName.toLowerCase(),
        destination_group: href?.split('/')[1] || null,
      });
    };
    const consentChanged = () => void syncAnalyticsConsent().then(pageView);
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);
    history.pushState = (...args) => {
      originalPushState(...args);
      pageView();
    };
    history.replaceState = (...args) => {
      originalReplaceState(...args);
      pageView();
    };

    void syncAnalyticsConsent().then(pageView);
    document.addEventListener('click', interaction);
    window.addEventListener('popstate', pageView);
    window.addEventListener(CONSENT_CHANGED_EVENT, consentChanged);

    const authSubscription = isSupabaseConfigured
      ? supabase.auth.onAuthStateChange((_event, session) => {
          void identifyAnalyticsUser(session?.user.id ?? null);
        }).data.subscription
      : null;

    return () => {
      document.removeEventListener('click', interaction);
      window.removeEventListener('popstate', pageView);
      window.removeEventListener(CONSENT_CHANGED_EVENT, consentChanged);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      authSubscription?.unsubscribe();
    };
  }, []);

  return null;
}
