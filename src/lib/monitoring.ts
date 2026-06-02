import { AnalyticsTracker } from './analytics';

// Performance monitoring
export class PerformanceMonitor {
  private metrics: {
    [key: string]: {
      count: number;
      totalTime: number;
      minTime: number;
      maxTime: number;
    };
  } = {};

  private tracker: AnalyticsTracker;

  constructor() {
    this.tracker = new AnalyticsTracker();
  }

  // Track function execution time
  async trackAsync<T>(
    name: string,
    fn: () => Promise<T>,
    tags: Record<string, any> = {}
  ): Promise<T> {
    const startTime = performance.now();

    try {
      const result = await fn();
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.recordMetric(name, duration);

      // Track performance events
      this.tracker.trackUIInteraction('performance', 'async', {
        name,
        duration,
        status: 'success',
        ...tags,
      });

      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.recordMetric(name, duration, true);

      // Track failed performance events
      this.tracker.trackUIInteraction('performance', 'async', {
        name,
        duration,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        ...tags,
      });

      throw error;
    }
  }

  // Track synchronous function execution time
  trackSync<T>(name: string, fn: () => T, tags: Record<string, any> = {}): T {
    const startTime = performance.now();

    try {
      const result = fn();
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.recordMetric(name, duration);

      // Track performance events
      this.tracker.trackUIInteraction('performance', 'sync', {
        name,
        duration,
        status: 'success',
        ...tags,
      });

      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.recordMetric(name, duration, true);

      // Track failed performance events
      this.tracker.trackUIInteraction('performance', 'sync', {
        name,
        duration,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        ...tags,
      });

      throw error;
    }
  }

  private recordMetric(name: string, duration: number, isError = false): void {
    if (!this.metrics[name]) {
      this.metrics[name] = {
        count: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
      };
    }

    const metric = this.metrics[name];
    metric.count++;
    metric.totalTime += duration;
    metric.minTime = Math.min(metric.minTime, duration);
    metric.maxTime = Math.max(metric.maxTime, duration);
  }

  getMetrics(): PerformanceMetrics {
    const result: PerformanceMetrics = {};

    Object.entries(this.metrics).forEach(([name, data]) => {
      result[name] = {
        count: data.count,
        avgTime: data.totalTime / data.count,
        minTime: data.minTime,
        maxTime: data.maxTime,
        totalTime: data.totalTime,
      };
    });

    return result;
  }

  resetMetrics(): void {
    this.metrics = {};
  }
}

// Resource monitoring
export class ResourceMonitor {
  private tracker: AnalyticsTracker;

  constructor() {
    this.tracker = new AnalyticsTracker();
  }

  // Monitor memory usage
  trackMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.tracker.trackUIInteraction('resource', 'memory', {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
      });
    }
  }

  // Monitor network requests
  trackNetworkRequest(url: string, method: string, duration: number, status: number): void {
    this.tracker.trackUIInteraction('network', 'request', {
      url,
      method,
      duration,
      status,
      timestamp: Date.now(),
    });
  }

  // Monitor page load performance
  trackPageLoad(): void {
    if ('timing' in performance) {
      const timing = (performance as PerformanceTiming).navigation;

      this.tracker.trackUIInteraction('performance', 'page_load', {
        dns: timing.domainLookupEnd - timing.domainLookupStart,
        tcp: timing.connectEnd - timing.connectStart,
        request: timing.responseStart - timing.requestStart,
        response: timing.responseEnd - timing.responseStart,
        dom: timing.domComplete - timing.domLoading,
        load: timing.loadEventEnd - timing.loadEventStart,
        total: timing.loadEventEnd - timing.navigationStart,
      });
    }
  }
}

// Error monitoring
export class ErrorMonitor {
  private tracker: AnalyticsTracker;

  constructor() {
    this.tracker = new AnalyticsTracker();

    // Global error handlers
    this.setupGlobalHandlers();
  }

  private setupGlobalHandlers(): void {
    // JavaScript errors
    window.addEventListener('error', event => {
      this.trackError('javascript', event.error, {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      });
    });

    // Promise rejections
    window.addEventListener('unhandledrejection', event => {
      this.trackError('promise', event.reason, {
        type: event.type,
        reason: event.reason,
      });
    });

    // Network errors
    window.addEventListener('offline', () => {
      this.trackError('network', new Error('Network connection lost'), {
        type: 'offline',
      });
    });

    window.addEventListener('online', () => {
      this.tracker.trackUIInteraction('network', 'online', {
        timestamp: Date.now(),
      });
    });
  }

  trackError(
    type: 'javascript' | 'promise' | 'network' | 'api' | 'ui',
    error: Error | any,
    context?: Record<string, any>
  ): void {
    const errorData = {
      type,
      message: error?.message || 'Unknown error',
      stack: error?.stack,
      context,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    this.tracker.trackUIInteraction('error', type, errorData);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${type.toUpperCase()} Error]:`, errorData);
    }
  }

  // API error handling
  trackApiError(endpoint: string, method: string, status: number, error?: any): void {
    this.trackError('api', error, {
      endpoint,
      method,
      status,
      timestamp: Date.now(),
    });
  }
}

// User experience monitoring
export class UXMonitor {
  private tracker: AnalyticsTracker;
  private interactions: Array<{
    element: string;
    action: string;
    timestamp: number;
    duration?: number;
  }> = [];

  constructor() {
    this.tracker = new AnalyticsTracker();
    this.setupInteractionTracking();
  }

  private setupInteractionTracking(): void {
    // Track clicks
    document.addEventListener('click', event => {
      const target = event.target as HTMLElement;
      const element = this.getElementSelector(target);

      this.interactions.push({
        element,
        action: 'click',
        timestamp: Date.now(),
      });

      // Debounce tracking
      this.debounceTrackInteractions();
    });

    // Track form inputs
    document.addEventListener('change', event => {
      const target = event.target as HTMLElement;
      const element = this.getElementSelector(target);

      this.interactions.push({
        element,
        action: 'input',
        timestamp: Date.now(),
      });

      this.debounceTrackInteractions();
    });
  }

  private getElementSelector(element: HTMLElement): string {
    if (element.id) return `#${element.id}`;
    if (element.className) return `.${element.className.split(' ').join('.')}`;
    return element.tagName.toLowerCase();
  }

  private debounceTrackInteractions(): void {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.flushInteractions();
    }, 5000);
  }

  private debounceTimer: NodeJS.Timeout = setTimeout(() => {}, 0);

  private flushInteractions(): void {
    if (this.interactions.length === 0) return;

    const interactions = [...this.interactions];
    this.interactions = [];

    this.tracker.trackUIInteraction('ux', 'batch', {
      interactions,
      count: interactions.length,
      timestamp: Date.now(),
    });
  }

  // Track scroll behavior
  trackScroll(): void {
    let scrollTimeout: NodeJS.Timeout;

    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const scrollPercentage =
          (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;

        this.tracker.trackUIInteraction('scroll', 'position', {
          percentage: Math.round(scrollPercentage),
          timestamp: Date.now(),
        });
      }, 100);
    });
  }
}

// Health check monitoring
export class HealthMonitor {
  private tracker: AnalyticsTracker;
  private checks: Map<string, HealthCheck> = new Map();

  constructor() {
    this.tracker = new AnalyticsTracker();
    this.startPeriodicChecks();
  }

  addCheck(name: string, check: HealthCheck): void {
    this.checks.set(name, check);
  }

  async runCheck(name: string): Promise<HealthResult> {
    const check = this.checks.get(name);
    if (!check) {
      throw new Error(`Health check "${name}" not found`);
    }

    const start = Date.now();
    try {
      const result = await check.check();
      const duration = Date.now() - start;

      this.tracker.trackUIInteraction('health', 'check', {
        name,
        status: result.healthy ? 'healthy' : 'unhealthy',
        duration,
        timestamp: Date.now(),
        ...result,
      });

      return {
        healthy: result.healthy,
        message: result.message,
        duration,
        timestamp: Date.now(),
      };
    } catch (error) {
      const duration = Date.now() - start;

      this.tracker.trackUIInteraction('health', 'check', {
        name,
        status: 'error',
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      });

      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Health check failed',
        duration,
        timestamp: Date.now(),
      };
    }
  }

  async runAllChecks(): Promise<HealthResults> {
    const results: HealthResults = {};
    const overall = { healthy: true };

    for (const [name] of this.checks) {
      results[name] = await this.runCheck(name);
      if (!results[name].healthy) {
        overall.healthy = false;
      }
    }

    this.tracker.trackUIInteraction('health', 'overall', {
      overall: overall.healthy ? 'healthy' : 'unhealthy',
      checks: Object.keys(results).length,
      timestamp: Date.now(),
    });

    return results;
  }

  private startPeriodicChecks(): void {
    // Run health checks every 5 minutes
    setInterval(
      async () => {
        await this.runAllChecks();
      },
      5 * 60 * 1000
    );
  }
}

// Types
interface PerformanceMetrics {
  [key: string]: {
    count: number;
    avgTime: number;
    minTime: number;
    maxTime: number;
    totalTime: number;
  };
}

interface HealthCheck {
  check: () => Promise<HealthResult>;
}

interface HealthResult {
  healthy: boolean;
  message: string;
  duration: number;
  timestamp: number;
}

interface HealthResults {
  [key: string]: HealthResult;
}

// Export instances
export const performanceMonitor = new PerformanceMonitor();
export const resourceMonitor = new ResourceMonitor();
export const errorMonitor = new ErrorMonitor();
export const uxMonitor = new UXMonitor();
export const healthMonitor = new HealthMonitor();

// Initialize monitoring
if (typeof window !== 'undefined') {
  // Track page load
  resourceMonitor.trackPageLoad();

  // Track memory usage every 30 seconds
  setInterval(() => {
    resourceMonitor.trackMemoryUsage();
  }, 30000);

  // Track scroll behavior
  uxMonitor.trackScroll();

  // Add basic health checks
  healthMonitor.addCheck('api', {
    check: async () => {
      try {
        const response = await fetch('/api/health');
        return {
          healthy: response.ok,
          message: response.ok ? 'API is healthy' : 'API is unhealthy',
        };
      } catch (error) {
        return {
          healthy: false,
          message: 'API connection failed',
        };
      }
    },
  });

  healthMonitor.addCheck('database', {
    check: async () => {
      try {
        const response = await fetch('/api/health/database');
        return {
          healthy: response.ok,
          message: response.ok ? 'Database is healthy' : 'Database is unhealthy',
        };
      } catch (error) {
        return {
          healthy: false,
          message: 'Database connection failed',
        };
      }
    },
  });
}
