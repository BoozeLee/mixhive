import mixpanel from 'mixpanel-browser';

// Import the mixpanel instance from the client component
import { mixpanel as mixpanelInstance } from '@/components/MixpanelClient';

// Event names
export const Events = {
  // User events
  USER_SIGNUP: 'User Signup',
  USER_LOGIN: 'User Login',
  USER_LOGOUT: 'User Logout',
  USER_PROFILE_UPDATE: 'User Profile Update',
  
  // Music events
  MUSIC_SEARCH: 'Music Search',
  MUSIC_PLAY: 'Music Play',
  MUSIC_PAUSE: 'Music Pause',
  MUSIC_SKIP: 'Music Skip',
  MUSIC_LIKE: 'Music Like',
  MUSIC_ADD_TO_PLAYLIST: 'Music Add to Playlist',
  
  // DJ events
  DJ_MIX_CREATE: 'DJ Mix Create',
  DJ_MIX_PUBLISH: 'DJ Mix Publish',
  DJ_mix_SHARE: 'DJ Mix Share',
  DJ_MIX_DOWNLOAD: 'DJ Mix Download',
  
  // Social events
  SOCIAL_FOLLOW: 'Social Follow',
  SOCIAL_COMMENT: 'Social Comment',
  SOCIAL_SHARE: 'Social Share',
  SOCIAL_LIKE: 'Social Like',
  
  // Navigation events
  PAGE_VIEW: 'Page View',
  NAVIGATION_CLICK: 'Navigation Click',
  
  // Feature usage
  FEATURE_USAGE: 'Feature Usage',
} as const;

type EventName = keyof typeof Events;

// Mixpanel service
export const mixpanelService = {
  // Initialize Mixpanel (if not already initialized)
  init: (token: string) => {
    if (!mixpanelInstance._loaded) {
      mixpanel.init(token, {
        debug: process.env.NODE_ENV === 'development',
        persistence: 'localStorage',
        opt_out_tracking_by_default: false,
      });
    }
  },

  // Identify user
  identify: (userId: string, properties?: Record<string, any>) => {
    mixpanel.identify(userId, properties);
  },

  // Reset user (for logout)
  reset: () => {
    mixpanel.reset();
  },

  // Track events
  track: (eventName: EventName, properties?: Record<string, any>) => {
    const eventKey = Events[eventName];
    mixpanel.track(eventKey, properties);
  },

  // Set user properties
  set: (properties: Record<string, any>) => {
    mixpanel.set(properties);
  },

  // Increment user properties
  increment: (property: string, amount: number = 1) => {
    mixpanel.increment(property, amount);
  },

  // Alias users (for merging user identities)
  alias: (newId: string, originalId?: string) => {
    mixpanel.alias(newId, originalId);
  },

  // Track page views
  trackPageView: (pathname: string, title?: string) => {
    mixpanel.track('Page View', {
      page: pathname,
      title: title || document?.title,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    });
  },

  // Get Mixpanel instance (for advanced usage)
  getInstance: () => mixpanel,
};

// Hook for using Mixpanel in components
export const useMixpanel = () => {
  return {
    track: mixpanelService.track,
    identify: mixpanelService.identify,
    reset: mixpanelService.reset,
    set: mixpanelService.set,
    increment: mixpanelService.increment,
    alias: mixpanelService.alias,
    trackPageView: mixpanelService.trackPageView,
    getInstance: mixpanelService.getInstance,
  };
};