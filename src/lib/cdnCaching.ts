/**
 * CDN Caching Configuration and Optimization
 *
 * Provides CDN-specific cache headers, cache key generation,
 * and optimization strategies for different media types.
 */

import { createHash } from 'crypto';
import { cdnConfig, MediaBucket } from './cdn';
import type { CacheConfig } from './cdn';

interface CacheOptions {
  bucket: MediaBucket;
  fileExtension?: string;
  customCacheKey?: string;
  edgeCache?: boolean;
  browserCache?: boolean;
  staleWhileRevalidate?: number;
  maxAge?: number;
}

interface CacheHeaders {
  'Cache-Control': string;
  'CDN-Cache-Key'?: string;
  'CDN-Cache-Tag'?: string;
  'CDN-Cache-Control'?: string;
  'X-Content-Type-Options'?: string;
  'X-Frame-Options'?: string;
  'Content-Security-Policy'?: string;
}

// Cache strategies for different file types
const CACHE_STRATEGIES: Record<MediaBucket, CacheConfig> = {
  'mix-audio': {
    maxAge: 31536000, // 1 year
    immutable: true,
    sMaxAge: 31536000,
    staleWhileRevalidate: 86400, // 1 day
    cdnCacheKey: 'audio-content',
  },
  'mix-artwork': {
    maxAge: 31536000, // 1 year
    immutable: true,
    sMaxAge: 31536000,
    staleWhileRevalidate: 86400,
    cdnCacheKey: 'artwork-content',
  },
  'mix-waveforms': {
    maxAge: 31536000, // 1 year
    immutable: true,
    sMaxAge: 31536000,
    staleWhileRevalidate: 86400,
    cdnCacheKey: 'waveform-content',
  },
  'profile-avatars': {
    maxAge: 86400, // 1 day
    immutable: false,
    sMaxAge: 3600, // 1 hour
    staleWhileRevalidate: 86400,
    cdnCacheKey: 'avatar-content',
  },
  'profile-banners': {
    maxAge: 86400, // 1 day
    immutable: false,
    sMaxAge: 3600, // 1 hour
    staleWhileRevalidate: 86400,
    cdnCacheKey: 'banner-content',
  },
  'buzz-media': {
    maxAge: 86400, // 1 day
    immutable: false,
    sMaxAge: 3600, // 1 hour
    staleWhileRevalidate: 86400,
    cdnCacheKey: 'buzz-content',
  },
};

// Cache key generation utilities
export class CacheKeyGenerator {
  private static generateBaseKey(bucket: MediaBucket, path: string): string {
    return `${bucket}:${path}`;
  }

  private static generateVersionKey(baseKey: string, version?: string): string {
    if (!version) return baseKey;
    return `${baseKey}:v:${version}`;
  }

  private static generateUserKey(baseKey: string, userId?: string): string {
    if (!userId) return baseKey;
    return `${baseKey}:user:${userId}`;
  }

  private static generateTimestampKey(baseKey: string): string {
    const timestamp = Date.now();
    return `${baseKey}:ts:${timestamp}`;
  }

  public static generateCacheKey(
    bucket: MediaBucket,
    path: string,
    options: {
      version?: string;
      userId?: string;
      timestamp?: boolean;
    } = {}
  ): string {
    let key = this.generateBaseKey(bucket, path);

    if (options.version) {
      key = this.generateVersionKey(key, options.version);
    }

    if (options.userId) {
      key = this.generateUserKey(key, options.userId);
    }

    if (options.timestamp) {
      key = this.generateTimestampKey(key);
    }

    return key;
  }

  public static generateETag(content: string): string {
    return createHash('md5').update(content).digest('hex');
  }

  public static generateContentHash(fileData: Buffer): string {
    return createHash('sha256').update(fileData).digest('hex');
  }
}

// Cache management utilities
export class CacheManager {
  private static getCacheStrategy(bucket: MediaBucket): CacheConfig {
    return CACHE_STRATEGIES[bucket] || CACHE_STRATEGIES['mix-audio'];
  }

  public static getCacheHeaders(bucket: MediaBucket, options?: CacheOptions): CacheHeaders {
    const strategy = this.getCacheStrategy(bucket);
    const headers: CacheHeaders = {
      'Cache-Control': this.buildCacheControl(strategy, options),
    };

    // Add CDN-specific headers
    if (strategy.cdnCacheKey || options?.customCacheKey) {
      headers['CDN-Cache-Key'] = options?.customCacheKey || strategy.cdnCacheKey;
    }

    if (cdnConfig.provider === 'cloudflare') {
      headers['CDN-Cache-Tag'] = bucket;
      headers['CDN-Cache-Control'] = this.buildCDNCacheControl(strategy);
    }

    // Security headers
    headers['X-Content-Type-Options'] = 'nosniff';
    headers['X-Frame-Options'] = 'DENY';

    // Content Security Policy for media
    headers['Content-Security-Policy'] = this.buildCSP(bucket);

    return headers;
  }

  private static buildCacheControl(strategy: CacheConfig, options?: CacheOptions): string {
    let cacheControl = `public, max-age=${options?.maxAge || strategy.maxAge}`;

    if (strategy.immutable) {
      cacheControl += ', immutable';
    }

    if (strategy.sMaxAge) {
      cacheControl += `, s-maxage=${strategy.sMaxAge}`;
    }

    if (strategy.staleWhileRevalidate || options?.staleWhileRevalidate) {
      const staleTime = strategy.staleWhileRevalidate || options!.staleWhileRevalidate!;
      cacheControl += `, stale-while-revalidate=${staleTime}`;
    }

    // Edge cache specific settings
    if (options?.edgeCache) {
      cacheControl += ', edge-cache=public';
    }

    return cacheControl;
  }

  private static buildCDNCacheControl(strategy: CacheConfig): string {
    let cdnCacheControl = 'public';

    if (strategy.immutable) {
      cdnCacheControl += ', immutable';
    }

    if (strategy.sMaxAge) {
      cdnCacheControl += ', s-maxage=' + strategy.sMaxAge;
    }

    return cdnCacheControl;
  }

  private static buildCSP(bucket: MediaBucket): string {
    const cspBase =
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';";

    switch (bucket) {
      case 'mix-audio':
        return `${cspBase} media-src 'self' blob: ${cdnConfig.baseUrl}; connect-src 'self' wss: ${cdnConfig.baseUrl};`;
      case 'mix-artwork':
      case 'profile-avatars':
      case 'profile-banners':
      case 'buzz-media':
        return `${cspBase} img-src 'self' data: blob: ${cdnConfig.baseUrl}; media-src 'self' blob: ${cdnConfig.baseUrl};`;
      case 'mix-waveforms':
        return `${cspBase} img-src 'self' data: blob: ${cdnConfig.baseUrl};`;
      default:
        return `${cspBase} img-src 'self' data: blob:; media-src 'self' blob:;`;
    }
  }

  public static shouldBypassCache(
    bucket: MediaBucket,
    path: string,
    options: {
      bypassForUpdates?: boolean;
      bypassForUsers?: boolean;
      bypassForNewContent?: boolean;
    } = {}
  ): boolean {
    // Bypass cache for user-specific content
    if (options.bypassForUsers && path.includes('/user/')) {
      return true;
    }

    // Bypass cache for frequently updated content
    if (options.bypassForUpdates && path.includes('/temp/')) {
      return true;
    }

    // Bypass cache for new content that might be updated
    if (options.bypassForNewContent && path.includes('/new/')) {
      return true;
    }

    return false;
  }

  public static getCacheTTL(bucket: MediaBucket): number {
    const strategy = this.getCacheStrategy(bucket);
    return strategy.maxAge * 1000; // Convert to milliseconds
  }

  public static getCacheKeyPrefix(bucket: MediaBucket): string {
    return `cdn:${bucket}:`;
  }

  public static generateCacheTag(bucket: MediaBucket, tags: string[] = []): string {
    const baseTags = [bucket];
    return [...baseTags, ...tags].join(',');
  }
}

// Cache optimization utilities
export class CacheOptimizer {
  public static optimizeForDelivery(bucket: MediaBucket): CacheHeaders {
    const headers = CacheManager.getCacheHeaders(bucket);

    // Optimize for fast delivery
    headers['Cache-Control'] = headers['Cache-Control'].replace(/max-age=\d+/, 'max-age=3600'); // 1 hour for delivery optimization

    return headers;
  }

  public static optimizeForStaticAssets(bucket: MediaBucket): CacheHeaders {
    const headers = CacheManager.getCacheHeaders(bucket);

    // Optimize for static assets (long cache)
    headers['Cache-Control'] = headers['Cache-Control'].replace(/max-age=\d+/, 'max-age=31536000'); // 1 year

    return headers;
  }

  public static optimizeForUserContent(bucket: MediaBucket): CacheHeaders {
    const headers = CacheManager.getCacheHeaders(bucket);

    // Shorter cache for user-generated content
    headers['Cache-Control'] = headers['Cache-Control'].replace(/max-age=\d+/, 'max-age=1800'); // 30 minutes

    return headers;
  }

  public static optimizeForRealTimeUpdates(bucket: MediaBucket): CacheHeaders {
    const headers = CacheManager.getCacheHeaders(bucket);

    // Very short cache for real-time content
    headers['Cache-Control'] = headers['Cache-Control'].replace(/max-age=\d+/, 'max-age=60'); // 1 minute

    return headers;
  }
}

// Cache validation utilities
export class CacheValidator {
  public static validateCacheKey(key: string): boolean {
    // Basic validation for cache keys
    return typeof key === 'string' && key.length > 0 && key.length < 256;
  }

  public static validateCacheHeaders(headers: CacheHeaders): boolean {
    // Validate cache control header
    if (!headers['Cache-Control']) {
      return false;
    }

    // Check for required cache control directives
    const cacheControl = headers['Cache-Control'];
    if (!cacheControl.includes('public') && !cacheControl.includes('private')) {
      return false;
    }

    return true;
  }

  public static generateValidationHeaders(): CacheHeaders {
    return {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    };
  }
}

// Cache analytics and monitoring
export class CacheAnalytics {
  private static cacheHits = new Map<string, number>();
  private static cacheMisses = new Map<string, number>();
  private static cacheErrors = new Map<string, number>();

  public static recordCacheHit(bucket: MediaBucket, path: string): void {
    const key = `${bucket}:${path}`;
    const current = this.cacheHits.get(key) || 0;
    this.cacheHits.set(key, current + 1);
  }

  public static recordCacheMiss(bucket: MediaBucket, path: string): void {
    const key = `${bucket}:${path}`;
    const current = this.cacheMisses.get(key) || 0;
    this.cacheMisses.set(key, current + 1);
  }

  public static recordCacheError(bucket: MediaBucket, path: string, error: string): void {
    const key = `${bucket}:${path}:${error}`;
    const current = this.cacheErrors.get(key) || 0;
    this.cacheErrors.set(key, current + 1);
  }

  public static getCacheStats(): {
    hits: Map<string, number>;
    misses: Map<string, number>;
    errors: Map<string, number>;
    totalHits: number;
    totalMisses: number;
    totalErrors: number;
    hitRate: number;
  } {
    const totalHits = Array.from(this.cacheHits.values()).reduce((sum, count) => sum + count, 0);
    const totalMisses = Array.from(this.cacheMisses.values()).reduce(
      (sum, count) => sum + count,
      0
    );
    const totalErrors = Array.from(this.cacheErrors.values()).reduce(
      (sum, count) => sum + count,
      0
    );
    const hitRate = totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0;

    return {
      hits: new Map(this.cacheHits),
      misses: new Map(this.cacheMisses),
      errors: new Map(this.cacheErrors),
      totalHits,
      totalMisses,
      totalErrors,
      hitRate,
    };
  }

  public static clearStats(): void {
    this.cacheHits.clear();
    this.cacheMisses.clear();
    this.cacheErrors.clear();
  }
}

// Export utilities
export const CDN_CACHE_UTILS = {
  CacheKeyGenerator,
  CacheManager,
  CacheOptimizer,
  CacheValidator,
  CacheAnalytics,
} as const;

// Default cache configuration
export const DEFAULT_CACHE_CONFIG = {
  audio: {
    maxAge: 31536000,
    immutable: true,
    sMaxAge: 31536000,
    staleWhileRevalidate: 86400,
  },
  artwork: {
    maxAge: 31536000,
    immutable: true,
    sMaxAge: 31536000,
    staleWhileRevalidate: 86400,
  },
  waveform: {
    maxAge: 31536000,
    immutable: true,
    sMaxAge: 31536000,
    staleWhileRevalidate: 86400,
  },
  avatar: {
    maxAge: 86400,
    immutable: false,
    sMaxAge: 3600,
    staleWhileRevalidate: 86400,
  },
  banner: {
    maxAge: 86400,
    immutable: false,
    sMaxAge: 3600,
    staleWhileRevalidate: 86400,
  },
  buzz: {
    maxAge: 86400,
    immutable: false,
    sMaxAge: 3600,
    staleWhileRevalidate: 86400,
  },
} as const;
