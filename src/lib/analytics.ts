import { supabase } from './storage';

// Analytics event types
export type AnalyticsEventType =
  | 'page_view'
  | 'mix_play'
  | 'mix_pause'
  | 'mix_complete'
  | 'mix_like'
  | 'mix_share'
  | 'mix_download'
  | 'profile_view'
  | 'profile_follow'
  | 'profile_unfollow'
  | 'comment_create'
  | 'comment_delete'
  | 'buzz_create'
  | 'buzz_like'
  | 'buzz_share'
  | 'search_perform'
  | 'upload_start'
  | 'upload_complete'
  | 'upload_error'
  | 'auth_login'
  | 'auth_register'
  | 'auth_logout'
  | 'ui_interaction';

// Analytics event data
export interface AnalyticsEvent {
  event_type: AnalyticsEventType;
  metadata?: Record<string, unknown>;
  profile_id?: string;
  session_id?: string;
  page_url?: string;
  referrer?: string;
  user_agent?: string;
  ip_address?: string;
  created_at: string;
}

// User behavior tracking
export class AnalyticsTracker {
  private sessionId: string;
  private currentPage?: string;

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async trackEvent(event: AnalyticsEvent): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const analyticsEvent = {
        ...event,
        profile_id: user?.id,
        session_id: this.sessionId,
        created_at: new Date().toISOString(),
      };
      await supabase.from('analytics_events').insert([analyticsEvent]);
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }

  // Page view tracking
  async trackPageView(pageUrl: string, referrer?: string): Promise<void> {
    if (this.currentPage === pageUrl) return; // Avoid duplicate tracking

    this.currentPage = pageUrl;

    await this.trackEvent({
      event_type: 'profile_view',
      page_url: pageUrl,
      referrer,
      metadata: { title: document.title },
      created_at: new Date().toISOString(),
    });
  }

  // Mix interaction tracking
  async trackMixInteraction(
    mixId: string,
    action: 'play' | 'pause' | 'complete' | 'like' | 'share' | 'download',
    data?: {
      position?: number;
      duration?: number;
      percentageWatched?: number;
    }
  ): Promise<void> {
    await this.trackEvent({
      event_type: `mix_${action}` as AnalyticsEventType,
      metadata: { mix_id: mixId, ...data },
      created_at: new Date().toISOString(),
    });
  }

  // User interaction tracking
  async trackUserInteraction(
    target: 'profile' | 'comment' | 'buzz',
    action: 'view' | 'follow' | 'unfollow' | 'create' | 'delete' | 'like' | 'share',
    targetId: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    await this.trackEvent({
      event_type: `${target}_${action}` as AnalyticsEventType,
      metadata: { target_id: targetId, ...data },
      created_at: new Date().toISOString(),
    });
  }

  // Search tracking
  async trackSearch(
    query: string,
    resultsCount: number,
    searchType: 'mixes' | 'djs' | 'all'
  ): Promise<void> {
    await this.trackEvent({
      event_type: 'search_perform',
      metadata: {
        query,
        results_count: resultsCount,
        search_type: searchType,
      },
      created_at: new Date().toISOString(),
    });

    // Also save to search history for logged-in users
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        await supabase.from('search_history').insert([
          {
            user_id: user.id,
            query,
            search_type: searchType,
            results_count: resultsCount,
          },
        ]);
      }
    } catch (error) {
      console.error('Search history error:', error);
    }
  }

  // Upload tracking
  async trackUploadStart(mixId?: string): Promise<void> {
    await this.trackEvent({
      event_type: 'upload_start',
      metadata: {
        mix_id: mixId,
        timestamp: Date.now(),
      },
      created_at: new Date().toISOString(),
    });
  }

  async trackUploadComplete(mixId: string, fileSize: number, duration: number): Promise<void> {
    await this.trackEvent({
      event_type: 'upload_complete',
      metadata: {
        mix_id: mixId,
        file_size: fileSize,
        duration,
        timestamp: Date.now(),
      },
      created_at: new Date().toISOString(),
    });
  }

  async trackUploadError(mixId?: string, error?: string): Promise<void> {
    await this.trackEvent({
      event_type: 'upload_error',
      metadata: {
        mix_id: mixId,
        error,
        timestamp: Date.now(),
      },
      created_at: new Date().toISOString(),
    });
  }

  // Authentication tracking
  async trackAuthAction(action: 'login' | 'register' | 'logout'): Promise<void> {
    await this.trackEvent({
      event_type: `auth_${action}` as AnalyticsEventType,
      metadata: {
        timestamp: Date.now(),
      },
      created_at: new Date().toISOString(),
    });
  }

  // UI interaction tracking
  async trackUIInteraction(
    element: string,
    action: 'click' | 'hover' | 'input',
    data?: Record<string, unknown>
  ): Promise<void> {
    await this.trackEvent({
      event_type: 'ui_interaction',
      metadata: {
        element,
        action,
        ...data,
        timestamp: Date.now(),
      },
      created_at: new Date().toISOString(),
    });
  }
}

// Analytics API for dashboard and insights
export class AnalyticsAPI {
  private supabase = supabase;

  // Get user analytics
  async getUserAnalytics(userId: string, days: number = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('analytics_events')
      .select('*')
      .eq('profile_id', userId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) throw error;

    return this.processAnalyticsData(data);
  }

  // Get mix analytics
  async getMixAnalytics(mixId: string, days: number = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('analytics_events')
      .select('*')
      .eq('event_type', 'mix_play')
      .eq('metadata->>mix_id', mixId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) throw error;

    return this.processMixAnalyticsData(data);
  }

  // Get trending mixes
  async getTrendingMixes(days: number = 7) {
    const _endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase.rpc('get_trending', {
      p_limit: 50,
      p_offset: 0,
    });

    if (error) throw error;

    return data;
  }

  // Get popular mixes
  async getPopularMixes(limit: number = 50) {
    const { data, error } = await this.supabase.from('popular_mixes').select('*').limit(limit);

    if (error) throw error;

    return data;
  }

  // Process analytics data
  private processAnalyticsData(events: unknown[]) {
    const totalEvents = events.length;
    const uniqueSessions = new Set(events.map(e => e.session_id)).size;
    const uniqueUsers = new Set(events.map(e => e.profile_id)).size;

    const eventsByType = events.reduce(
      (acc, event) => {
        acc[event.event_type] = (acc[event.event_type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const dailyActivity = events.reduce(
      (acc, event) => {
        const date = new Date(event.created_at).toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalEvents,
      uniqueSessions,
      uniqueUsers,
      eventsByType,
      dailyActivity,
      period: {
        start: events[0]?.created_at,
        end: events[events.length - 1]?.created_at,
      },
    };
  }

  // Process mix analytics data
  private processMixAnalyticsData(events: unknown[]) {
    const totalPlays = events.length;
    const uniqueListeners = new Set(events.map(e => e.profile_id)).size;
    const avgCompletion =
      events.reduce((sum, event) => {
        const percentage = event.metadata?.percentageWatched || 0;
        return sum + percentage;
      }, 0) / totalPlays;

    return {
      totalPlays,
      uniqueListeners,
      avgCompletion: Math.round(avgCompletion * 100) / 100,
      period: {
        start: events[0]?.created_at,
        end: events[events.length - 1]?.created_at,
      },
    };
  }
}

// Initialize analytics tracker
export const analyticsTracker = new AnalyticsTracker();
export const analyticsAPI = new AnalyticsAPI();

// Auto-track page views
if (typeof window !== 'undefined') {
  let currentPage = window.location.pathname;

  // Track initial page view
  analyticsTracker.trackPageView(currentPage);

  // Track page changes
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args: unknown[]) {
    originalPushState.apply(this, args);
    const newPage = window.location.pathname;
    if (newPage !== currentPage) {
      currentPage = newPage;
      analyticsTracker.trackPageView(newPage);
    }
  };

  history.replaceState = function (...args: unknown[]) {
    originalReplaceState.apply(this, args);
    const newPage = window.location.pathname;
    if (newPage !== currentPage) {
      currentPage = newPage;
      analyticsTracker.trackPageView(newPage);
    }
  };

  // Track browser visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Page hidden - pause tracking
    } else {
      // Page visible - resume tracking
      analyticsTracker.trackPageView(window.location.pathname);
    }
  });
}
