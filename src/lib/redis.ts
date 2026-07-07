import Redis from 'ioredis';

// Redis key prefixes for better organization
const KEY_PREFIXES = {
  USER: 'user:',
  MIX: 'mix:',
  FEED: 'feed:',
  NOTIFICATION: 'notification:',
  TRENDING: 'trending:',
  STATS: 'stats:',
  SESSION: 'session:',
  RATE_LIMIT: 'rate_limit:',
} as const;

// Cache TTL values (in seconds)
const TTL = {
  USER_FEED: 300, // 5 minutes
  TRENDING_MIXES: 600, // 10 minutes
  USER_STATS: 1800, // 30 minutes
  NOTIFICATIONS: 60, // 1 minute
  SESSION: 3600, // 1 hour
  RATE_LIMIT: 60, // 1 minute
} as const;

export interface CacheOptions {
  ttl?: number;
  prefix?: string;
}

export interface FeedCacheData {
  data: unknown[];
  cursor: string | null;
  timestamp: number;
}

export interface StatsCacheData {
  totalMixes: number;
  totalUsers: number;
  totalPlays: number;
  liveNow: number;
  timestamp: number;
}

export interface RedisConnectionInfo {
  configured: boolean;
  host: string | null;
  port: number | null;
  protocol: string | null;
}

export interface RedisHealth extends RedisConnectionInfo {
  connected: boolean;
  latency: number;
  memoryUsage: string;
  keyCount: number;
  error: string | null;
  errorCode: string | null;
}

class RedisCache {
  private client: Redis | null = null;
  private isConnected = false;

  public get isAvailable(): boolean {
    return this.isConnected && this.client?.status === 'ready';
  }
  private connectPromise: Promise<void> | null = null;
  private connectionInfo: RedisConnectionInfo = {
    configured: false,
    host: null,
    port: null,
    protocol: null,
  };
  private lastError: { message: string; code: string | null } | null = null;

  constructor() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      this.lastError = {
        message: 'REDIS_URL is not configured',
        code: 'REDIS_URL_MISSING',
      };
      console.warn('Redis URL not found in environment variables. Redis cache disabled.');
      return;
    }

    this.connectionInfo = parseRedisConnectionInfo(redisUrl);

    this.client = new Redis(redisUrl, {
      enableOfflineQueue: false,
      lazyConnect: true,
      connectTimeout: 3000,
      commandTimeout: 3000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      ...(this.connectionInfo.protocol === 'rediss:' ? { tls: {} } : {}),
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this.client) return;

    this.client.on('connect', () => {
      console.log('Redis connected successfully');
      this.isConnected = true;
      this.lastError = null;
    });

    this.client.on('error', error => {
      this.lastError = normalizeRedisError(error);
      console.warn('Redis error:', this.lastError.message);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      console.log('Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      console.log('Redis reconnecting...');
      this.isConnected = false;
    });
  }

  public async connect(): Promise<void> {
    if (!this.client) {
      this.isConnected = false;
      throw new Error(this.lastError?.message || 'Redis client is not configured');
    }

    if (this.isConnected && this.client.status === 'ready') return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = this.client
      .connect()
      .then(() => {
        this.isConnected = true;
        this.lastError = null;
      })
      .catch(error => {
        this.lastError = normalizeRedisError(error);
        console.warn('Failed to connect to Redis:', this.lastError.message);
        this.isConnected = false;
        throw error;
      })
      .finally(() => {
        this.connectPromise = null;
      });

    return this.connectPromise;
  }

  public async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  public isHealthy(): boolean {
    return this.isConnected;
  }

  // Helper method to create cache keys
  private createKey(prefix: string, key: string): string {
    return `${prefix}${key}`;
  }

  // Generic cache operations
  public async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    await this.connect().catch(() => undefined);
    if (!this.isConnected) return;

    const { ttl = TTL.USER_FEED, prefix = '' } = options;
    const fullKey = this.createKey(prefix, key);

    try {
      const serializedValue = JSON.stringify({
        data: value,
        timestamp: Date.now(),
      });

      await this.client?.setex(fullKey, ttl, serializedValue);
    } catch (error) {
      console.error(`Failed to set cache for key ${key}:`, error);
    }
  }

  public async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    await this.connect().catch(() => undefined);
    if (!this.isConnected) return null;

    const { prefix = '' } = options;
    const fullKey = this.createKey(prefix, key);

    try {
      const value = await this.client?.get(fullKey);
      if (!value) return null;

      const parsed = JSON.parse(value);
      return parsed.data;
    } catch (error) {
      console.error(`Failed to get cache for key ${key}:`, error);
      return null;
    }
  }

  public async del(key: string, options: CacheOptions = {}): Promise<void> {
    await this.connect().catch(() => undefined);
    if (!this.isConnected) return;

    const { prefix = '' } = options;
    const fullKey = this.createKey(prefix, key);

    try {
      await this.client?.del(fullKey);
    } catch (error) {
      console.error(`Failed to delete cache for key ${key}:`, error);
    }
  }

  public async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    await this.connect().catch(() => undefined);
    if (!this.isConnected) return false;

    const { prefix = '' } = options;
    const fullKey = this.createKey(prefix, key);

    try {
      return (await this.client?.exists(fullKey)) === 1;
    } catch (error) {
      console.error(`Failed to check cache existence for key ${key}:`, error);
      return false;
    }
  }

  // Specialized cache methods for different data types

  // Feed caching
  public async setFeedCache(
    userId: string,
    feedData: FeedCacheData,
    options: CacheOptions = {}
  ): Promise<void> {
    await this.set(`${KEY_PREFIXES.FEED}${userId}`, feedData, {
      ...options,
      ttl: TTL.USER_FEED,
      prefix: KEY_PREFIXES.FEED,
    });
  }

  public async getFeedCache(userId: string): Promise<FeedCacheData | null> {
    return this.get<FeedCacheData>(`${KEY_PREFIXES.FEED}${userId}`, { prefix: KEY_PREFIXES.FEED });
  }

  // Trending mixes caching
  public async setTrendingCache(
    genre: string,
    trendingData: unknown[],
    cursor: string | null = null
  ): Promise<void> {
    const cacheKey = `${KEY_PREFIXES.TRENDING}${genre || 'all'}`;
    await this.set(
      cacheKey,
      {
        data: trendingData,
        cursor,
        timestamp: Date.now(),
      },
      { ttl: TTL.TRENDING_MIXES }
    );
  }

  public async getTrendingCache(
    genre: string = 'all'
  ): Promise<{ data: unknown[]; cursor: string | null } | null> {
    const cacheKey = `${KEY_PREFIXES.TRENDING}${genre}`;
    const cached = await this.get<{ data: unknown[]; cursor: string | null; timestamp: number }>(
      cacheKey
    );

    if (!cached) return null;

    // Check if cache is still fresh (less than 10 minutes old)
    const age = (Date.now() - cached.timestamp) / 1000;
    if (age > TTL.TRENDING_MIXES) {
      await this.del(cacheKey);
      return null;
    }

    return cached;
  }

  // User stats caching
  public async setUserStatsCache(userId: string, stats: StatsCacheData): Promise<void> {
    await this.set(`${KEY_PREFIXES.STATS}${userId}`, stats, { ttl: TTL.USER_STATS });
  }

  public async getUserStatsCache(userId: string): Promise<StatsCacheData | null> {
    return this.get<StatsCacheData>(`${KEY_PREFIXES.STATS}${userId}`);
  }

  // Notification caching
  public async setNotificationsCache(userId: string, notifications: unknown[]): Promise<void> {
    await this.set(`${KEY_PREFIXES.NOTIFICATION}${userId}`, notifications, {
      ttl: TTL.NOTIFICATIONS,
    });
  }

  public async getNotificationsCache(userId: string): Promise<unknown[] | null> {
    return this.get<unknown[]>(`${KEY_PREFIXES.NOTIFICATION}${userId}`);
  }

  // Rate limiting
  public async incrementRateLimit(
    key: string,
    limit: number,
    window: number
  ): Promise<{
    current: number;
    limit: number;
    remaining: number;
    reset: number;
  }> {
    await this.connect().catch(() => undefined);
    if (!this.isConnected) {
      return {
        current: 0,
        limit,
        remaining: limit,
        reset: Date.now() + window * 1000,
      };
    }

    const rateLimitKey = `${KEY_PREFIXES.RATE_LIMIT}${key}`;
    const now = Date.now();
    const resetTime = now + window * 1000;

    try {
      // Remove expired keys
      await this.client?.zremrangebyscore(rateLimitKey, 0, now - window * 1000);

      // Add current request
      await this.client?.zadd(rateLimitKey, now, `${now}-${Math.random()}`);

      // Set expiration
      await this.client?.expire(rateLimitKey, window);

      // Get current count
      const current = (await this.client?.zcard(rateLimitKey)) ?? 0;

      return {
        current,
        limit,
        remaining: Math.max(0, limit - current),
        reset: resetTime,
      };
    } catch (error) {
      console.error('Rate limiting error:', error);
      return {
        current: 0,
        limit,
        remaining: limit,
        reset: resetTime,
      };
    }
  }

  /**
   * Fail-closed variant: returns null when Redis is unavailable or errors.
   * Callers MUST treat null as "over limit" for security-sensitive endpoints.
   */
  public async strictRateLimit(
    key: string,
    limit: number,
    window: number
  ): Promise<{ current: number; limit: number; remaining: number; reset: number } | null> {
    await this.connect().catch(() => undefined);
    if (!this.isAvailable) return null;

    const rateLimitKey = `${KEY_PREFIXES.RATE_LIMIT}${key}`;
    const now = Date.now();
    const resetTime = now + window * 1000;

    try {
      await this.client!.zremrangebyscore(rateLimitKey, 0, now - window * 1000);
      await this.client!.zadd(rateLimitKey, now, `${now}-${Math.random()}`);
      await this.client!.expire(rateLimitKey, window);
      const current = (await this.client!.zcard(rateLimitKey)) ?? 0;
      return { current, limit, remaining: Math.max(0, limit - current), reset: resetTime };
    } catch (error) {
      console.error('strictRateLimit error:', error);
      return null;
    }
  }

  // Cache invalidation
  public async invalidateUserCache(userId: string): Promise<void> {
    await this.connect().catch(() => undefined);
    if (!this.isConnected || !this.client) return;

    const patterns = [
      `${KEY_PREFIXES.FEED}${userId}*`,
      `${KEY_PREFIXES.STATS}${userId}*`,
      `${KEY_PREFIXES.NOTIFICATION}${userId}*`,
    ];

    for (const pattern of patterns) {
      try {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } catch (error) {
        console.error(`Failed to invalidate cache for pattern ${pattern}:`, error);
      }
    }
  }

  public async invalidateMixCache(mixId: string): Promise<void> {
    await this.connect().catch(() => undefined);
    if (!this.isConnected || !this.client) return;

    try {
      // Invalidate related feeds that might contain this mix
      const feedKeys = await this.client.keys(`${KEY_PREFIXES.FEED}*`);
      for (const key of feedKeys) {
        // In a real implementation, you'd check if the cache contains this mix
        // For now, just invalidate all feeds
        await this.client.del(key);
      }
    } catch (error) {
      console.error(`Failed to invalidate mix cache for mix ${mixId}:`, error);
    }
  }

  // Health check
  public async healthCheck(): Promise<RedisHealth> {
    await this.connect().catch(() => undefined);
    if (!this.isConnected || !this.client) {
      return {
        ...this.connectionInfo,
        connected: false,
        latency: 0,
        memoryUsage: 'N/A',
        keyCount: 0,
        error: this.lastError?.message || null,
        errorCode: this.lastError?.code || null,
      };
    }

    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;
      const info = await this.client.info('memory');
      const keyCount = await this.client.dbsize();

      return {
        ...this.connectionInfo,
        connected: true,
        latency,
        memoryUsage: info || 'N/A',
        keyCount,
        error: null,
        errorCode: null,
      };
    } catch (error) {
      this.lastError = normalizeRedisError(error);
      console.warn('Redis health check failed:', this.lastError.message);
      return {
        ...this.connectionInfo,
        connected: false,
        latency: 0,
        memoryUsage: 'N/A',
        keyCount: 0,
        error: this.lastError.message,
        errorCode: this.lastError.code,
      };
    }
  }

  public async keys(pattern: string): Promise<string[]> {
    await this.connect().catch(() => undefined);
    if (!this.isConnected || !this.client) return [];

    return this.client.keys(pattern);
  }

  public async dbsize(): Promise<number> {
    await this.connect().catch(() => undefined);
    if (!this.isConnected || !this.client) return 0;

    return this.client.dbsize();
  }

  public async info(section?: string): Promise<string> {
    await this.connect().catch(() => undefined);
    if (!this.isConnected || !this.client) return '';

    return this.client.info(section);
  }

  public async increment(key: string): Promise<number> {
    await this.connect().catch(() => undefined);
    if (!this.isConnected || !this.client) return 0;

    return this.client.incr(key);
  }

  public async decrement(key: string): Promise<number> {
    await this.connect().catch(() => undefined);
    if (!this.isConnected || !this.client) return 0;

    return this.client.decr(key);
  }

  public async deleteMany(keys: string[]): Promise<void> {
    await this.connect().catch(() => undefined);
    if (!this.isConnected || !this.client || keys.length === 0) return;

    await this.client.del(...keys);
  }
}

function parseRedisConnectionInfo(redisUrl: string): RedisConnectionInfo {
  try {
    const parsed = new URL(redisUrl);
    return {
      configured: true,
      host: parsed.hostname || null,
      port: parsed.port ? Number(parsed.port) : null,
      protocol: parsed.protocol || null,
    };
  } catch {
    return {
      configured: true,
      host: null,
      port: null,
      protocol: null,
    };
  }
}

function normalizeRedisError(error: unknown): { message: string; code: string | null } {
  if (error instanceof Error) {
    const code =
      typeof (error as Error & { code?: unknown }).code === 'string'
        ? (error as Error & { code: string }).code
        : null;

    return {
      message: error.message,
      code,
    };
  }

  return {
    message: String(error),
    code: null,
  };
}

// Global instance
export const redisCache = new RedisCache();

// Utility functions for cache management
export const cacheUtils = {
  // Generate cache key with user context
  userKey: (userId: string, suffix: string): string => `${KEY_PREFIXES.USER}${userId}:${suffix}`,

  // Generate cache key with mix context
  mixKey: (mixId: string, suffix: string): string => `${KEY_PREFIXES.MIX}${mixId}:${suffix}`,

  // Check if cache is fresh
  isCacheFresh: (timestamp: number, ttl: number): boolean => {
    const age = (Date.now() - timestamp) / 1000;
    return age < ttl;
  },

  // Invalidate cache for multiple keys
  invalidateMultiple: async (keys: string[]): Promise<void> => {
    if (!redisCache.isHealthy()) return;

    try {
      await redisCache.deleteMany(keys);
    } catch (error) {
      console.error('Failed to invalidate multiple cache keys:', error);
    }
  },
};
