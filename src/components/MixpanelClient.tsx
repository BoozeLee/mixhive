'use client';

import { useEffect } from 'react';
import mixpanelBrowser from 'mixpanel-browser';

interface MixpanelClientProps {
  token?: string;
}

export function MixpanelClient({ token }: MixpanelClientProps) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_MIXPANEL_TOKEN) {
      mixpanelBrowser.init(process.env.NEXT_PUBLIC_MIXPANEL_TOKEN, {
        debug: process.env.NODE_ENV === 'development',
        persistence: 'localStorage',
        opt_out_tracking_by_default: false,
      });

      // Identify user if they have an ID (this should be set after authentication)
      if (typeof window !== 'undefined') {
        const userId = localStorage.getItem('mixpanel_user_id');
        if (userId) {
          mixpanelBrowser.identify(userId);
        }
      }

      // Track page views
      const trackPageView = () => {
        mixpanelBrowser.track('Page View', {
          page: window.location.pathname,
          title: document.title,
          url: window.location.href,
        });
      };

      // Track initial page view
      trackPageView();

      // Track page changes
      const handleRouteChange = () => {
        trackPageView();
      };

      // Listen for navigation events
      window.addEventListener('popstate', handleRouteChange);
      
      // Clean up
      return () => {
        window.removeEventListener('popstate', handleRouteChange);
      };
    }
  }, []);

  return null;
}

export const mixpanel = mixpanelBrowser;
