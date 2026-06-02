import { supabase } from './storage';

// CDN configuration interface
interface CDNConfig {
  provider: 'cloudflare' | 'aws' | 'custom';
  domain: string;
  cacheConfig: {
    publicMaxAge: number;
    immutableMaxAge: number;
    browserCache: boolean;
    serverCache: boolean;
  };
  imageOptimization: {
    enabled: boolean;
    formats: string[];
    quality: number;
    maxWidth: number;
    maxHeight: number;
  };
  videoOptimization: {
    enabled: boolean;
    formats: string[];
    quality: string;
    adaptiveStreaming: boolean;
  };
  assetOptimization: {
    minify: boolean;
    compression: boolean;
    criticalCss: boolean;
  };
}

// CDN optimization class
export class CDNOptimizer {
  private config: CDNConfig;

  constructor(config: CDNConfig) {
    this.config = config;
  }

  // Optimize image URLs for CDN
  optimizeImageURL(
    url: string,
    options: {
      width?: number;
      height?: number;
      quality?: number;
      format?: string;
      fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
    } = {}
  ): string {
    if (!this.config.imageOptimization.enabled) {
      return url;
    }

    const parsedUrl = new URL(url);
    const params = new URLSearchParams(parsedUrl.search);

    // Add optimization parameters
    if (options.width) params.set('w', options.width.toString());
    if (options.height) params.set('h', options.height.toString());
    if (options.quality) params.set('q', options.quality.toString());
    if (options.format) params.set('f', options.format);
    if (options.fit) params.set('fit', options.fit);

    // Apply quality settings
    if (!options.quality && this.config.imageOptimization.quality) {
      params.set('q', this.config.imageOptimization.quality.toString());
    }

    // Apply format
    if (!options.format && this.config.imageOptimization.formats.length > 0) {
      params.set('f', this.config.imageOptimization.formats[0]);
    }

    // Apply size limits
    if (!options.width && this.config.imageOptimization.maxWidth) {
      params.set('max-w', this.config.imageOptimization.maxWidth.toString());
    }
    if (!options.height && this.config.imageOptimization.maxHeight) {
      params.set('max-h', this.config.imageOptimization.maxHeight.toString());
    }

    parsedUrl.search = params.toString();
    return parsedUrl.toString();
  }

  // Optimize video URLs for CDN
  optimizeVideoURL(
    url: string,
    options: {
      quality?: string;
      format?: string;
      adaptive?: boolean;
    } = {}
  ): string {
    if (!this.config.videoOptimization.enabled) {
      return url;
    }

    const parsedUrl = new URL(url);
    const params = new URLSearchParams(parsedUrl.search);

    // Add optimization parameters
    if (options.quality) params.set('q', options.quality);
    if (options.format) params.set('f', options.format);
    if (options.adaptive) params.set('adaptive', 'true');

    // Apply quality settings
    if (!options.quality && this.config.videoOptimization.quality) {
      params.set('q', this.config.videoOptimization.quality);
    }

    // Apply format
    if (!options.format && this.config.videoOptimization.formats.length > 0) {
      params.set('f', this.config.videoOptimization.formats[0]);
    }

    // Apply adaptive streaming
    if (!options.adaptive && this.config.videoOptimization.adaptiveStreaming) {
      params.set('adaptive', 'true');
    }

    parsedUrl.search = params.toString();
    return parsedUrl.toString();
  }

  // Generate CDN URL for static assets
  getAssetURL(path: string, type: 'image' | 'video' | 'audio' | 'document'): string {
    const baseDomain = this.config.domain;
    const assetPath = this.normalizeAssetPath(path);

    switch (type) {
      case 'image':
        return `${baseDomain}/images/${assetPath}`;
      case 'video':
        return `${baseDomain}/videos/${assetPath}`;
      case 'audio':
        return `${baseDomain}/audio/${assetPath}`;
      case 'document':
        return `${baseDomain}/docs/${assetPath}`;
      default:
        return `${baseDomain}/${assetPath}`;
    }
  }

  // Normalize asset path
  private normalizeAssetPath(path: string): string {
    // Remove leading slash
    if (path.startsWith('/')) {
      path = path.substring(1);
    }

    // Remove double slashes
    path = path.replace(/\/+/g, '/');

    return path;
  }

  // Get cache headers
  getCacheHeaders(type: 'static' | 'dynamic' | 'api'): Record<string, string> {
    const headers: Record<string, string> = {};

    switch (type) {
      case 'static':
        headers['Cache-Control'] =
          `public, max-age=${this.config.cacheConfig.publicMaxAge}, immutable`;
        break;
      case 'dynamic':
        headers['Cache-Control'] =
          `public, max-age=${this.config.cacheConfig.publicMaxAge / 2}, must-revalidate`;
        break;
      case 'api':
        headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        break;
    }

    if (this.config.cacheConfig.browserCache) {
      headers['Vary'] = 'Accept-Encoding';
    }

    return headers;
  }
}

// CDN configuration factory
export class CDNConfigFactory {
  private static configs: { [key: string]: CDNConfig } = {};

  static getConfig(provider: 'cloudflare' | 'aws' | 'custom'): CDNConfig {
    if (this.configs[provider]) {
      return this.configs[provider];
    }

    const config = this.createConfig(provider);
    this.configs[provider] = config;
    return config;
  }

  private static createConfig(provider: 'cloudflare' | 'aws' | 'custom'): CDNConfig {
    switch (provider) {
      case 'cloudflare':
        return {
          provider: 'cloudflare',
          domain: 'https://cdn.mixhive.app',
          cacheConfig: {
            publicMaxAge: 31536000, // 1 year for static assets
            immutableMaxAge: 31536000,
            browserCache: true,
            serverCache: true,
          },
          imageOptimization: {
            enabled: true,
            formats: ['webp', 'avif', 'jpeg'],
            quality: 85,
            maxWidth: 1920,
            maxHeight: 1080,
          },
          videoOptimization: {
            enabled: true,
            formats: ['mp4', 'webm'],
            quality: 'medium',
            adaptiveStreaming: true,
          },
          assetOptimization: {
            minify: true,
            compression: true,
            criticalCss: true,
          },
        };

      case 'aws':
        return {
          provider: 'aws',
          domain: 'https://d1234567890.cloudfront.net',
          cacheConfig: {
            publicMaxAge: 31536000,
            immutableMaxAge: 31536000,
            browserCache: true,
            serverCache: true,
          },
          imageOptimization: {
            enabled: true,
            formats: ['webp', 'avif', 'jpeg'],
            quality: 80,
            maxWidth: 1920,
            maxHeight: 1080,
          },
          videoOptimization: {
            enabled: true,
            formats: ['mp4', 'webm'],
            quality: 'medium',
            adaptiveStreaming: true,
          },
          assetOptimization: {
            minify: true,
            compression: true,
            criticalCss: true,
          },
        };

      case 'custom':
        return {
          provider: 'custom',
          domain: process.env.CUSTOM_CDN_URL || 'https://cdn.mixhive.app',
          cacheConfig: {
            publicMaxAge: 86400, // 24 hours
            immutableMaxAge: 31536000,
            browserCache: true,
            serverCache: true,
          },
          imageOptimization: {
            enabled: true,
            formats: ['webp', 'jpeg'],
            quality: 75,
            maxWidth: 1280,
            maxHeight: 720,
          },
          videoOptimization: {
            enabled: true,
            formats: ['mp4'],
            quality: 'medium',
            adaptiveStreaming: false,
          },
          assetOptimization: {
            minify: true,
            compression: true,
            criticalCss: true,
          },
        };

      default:
        throw new Error(`Unsupported CDN provider: ${provider}`);
    }
  }
}

// CDN analytics tracking
export class CDNAAnalytics {
  private supabase = supabase;

  // Track CDN usage
  async trackCDNUsage(
    type: 'image' | 'video' | 'audio' | 'document',
    operation: 'serve' | 'optimize' | 'cache_hit' | 'cache_miss',
    size: number,
    duration: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await this.supabase.from('cdn_analytics').insert([
        {
          type,
          operation,
          size,
          duration,
          metadata: metadata || {},
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      console.error('CDN analytics tracking failed:', error);
    }
  }

  // Get CDN usage statistics
  async getCDNUsageStats(days: number = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('cdn_analytics')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) throw error;

    const stats = {
      totalRequests: data.length,
      totalBandwidth: data.reduce((sum, item) => sum + item.size, 0),
      avgDuration: data.reduce((sum, item) => sum + item.duration, 0) / data.length,
      byType: {} as Record<string, number>,
      byOperation: {} as Record<string, number>,
      dailyUsage: {} as Record<string, number>,
    };

    // Group by type
    data.forEach(item => {
      stats.byType[item.type] = (stats.byType[item.type] || 0) + 1;
    });

    // Group by operation
    data.forEach(item => {
      stats.byOperation[item.operation] = (stats.byOperation[item.operation] || 0) + 1;
    });

    // Group by day
    data.forEach(item => {
      const date = new Date(item.created_at).toISOString().split('T')[0];
      stats.dailyUsage[date] = (stats.dailyUsage[date] || 0) + 1;
    });

    return stats;
  }

  // Get CDN performance metrics
  async getCDNPerformanceMetrics() {
    const { data, error } = await this.supabase
      .from('cdn_performance')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return data;
  }
}

// Initialize CDN optimization
export function initializeCDN(): CDNOptimizer {
  const provider = process.env.CDN_PROVIDER || 'cloudflare';
  const config = CDNConfigFactory.getConfig(provider as 'cloudflare' | 'aws' | 'custom');
  return new CDNOptimizer(config);
}

// Export instances
export const cdnOptimizer = initializeCDN();
export const cdnAnalytics = new CDNAAnalytics();

// Default CDN configuration
export const defaultCDNConfig: CDNConfig = {
  provider: 'cloudflare',
  domain: 'https://cdn.mixhive.app',
  cacheConfig: {
    publicMaxAge: 31536000,
    immutableMaxAge: 31536000,
    browserCache: true,
    serverCache: true,
  },
  imageOptimization: {
    enabled: true,
    formats: ['webp', 'avif', 'jpeg'],
    quality: 85,
    maxWidth: 1920,
    maxHeight: 1080,
  },
  videoOptimization: {
    enabled: true,
    formats: ['mp4', 'webm'],
    quality: 'medium',
    adaptiveStreaming: true,
  },
  assetOptimization: {
    minify: true,
    compression: true,
    criticalCss: true,
  },
};
