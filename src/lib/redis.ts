import Redis from 'ioredis'

// Redis key prefixes for better organization
const KEY_PREFIXES = {
  USER: 'user:',
  MIX: 'mix:',
  FEED: 'feed:',
  NOTIFICATION: 'notification:',
  TRENDING: 'trending:',
  STATS: 'stats:',
  SESSION: 'session:',
  RATE_LIMIT: 'rate_limit:'
} as const

// Cache TTL values (in seconds)
const TTL = {
  USER_FEED: 300, // 5 minutes
  TRENDING_MIXES: 600, // 10 minutes
  USER_STATS: 1800, // 30 minutes
  NOTIFICATIONS: 60, // 1 minute
  SESSION: 3600, // 1 hour
  RATE_LIMIT: 60 // 1 minute
} as const

export interface CacheOptions {
  ttl?: number
  prefix?: string
}

export interface FeedCacheData {
  data: any[]
  cursor: string | null
  timestamp: number
}

export interface StatsCacheData {
  totalMixes: number
  totalUsers: number
  totalPlays: number
  liveNow: number
  timestamp: number
}

class RedisCache {
  private client: Redis
  private isConnected = false

  constructor() {
    const redisUrl = process.env.REDIS_URL
    
    if (!redisUrl) {
      console.warn('Redis URL not found in environment variables. Using mock client.')
      this.client = new Redis() // This will fail gracefully
      return
    }

    this.client = new Redis(redisUrl, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 5000,
      commandTimeout: 3000
    })

    this.setupEventHandlers()
  }

  private setupEventHandlers() {
    this.client.on('connect', () => {
      console.log('Redis connected successfully')
      this.isConnected = true
    })

    this.client.on('error', (error) => {
      console.error('Redis error:', error)
      this.isConnected = false
    })

    this.client.on('close', () => {
      console.log('Redis connection closed')
      this.isConnected = false
    })

    this.client.on('reconnecting', () => {
      console.log('Redis reconnecting...')
      this.isConnected = false
    })
  }

  public async connect(): Promise<void> {
    if (this.isConnected) return
    
    try {
      await this.client.connect()
      this.isConnected = true
    } catch (error) {
      console.error('Failed to connect to Redis:', error)
      this.isConnected = false
      throw error
    }
  }

  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.quit()
      this.isConnected = false
    }
  }

  public isHealthy(): boolean {
    return this.isConnected
  }

  // Helper method to create cache keys
  private createKey(prefix: string, key: string): string {
    return `${prefix}${key}`
  }

  // Generic cache operations
  public async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    if (!this.isConnected) return

    const { ttl = TTL.USER_FEED, prefix = '' } = options
    const fullKey = this.createKey(prefix, key)
    
    try {
      const serializedValue = JSON.stringify({
        data: value,
        timestamp: Date.now()
      })
      
      await this.client.setex(fullKey, ttl, serializedValue)
    } catch (error) {
      console.error(`Failed to set cache for key ${key}:`, error)
    }
  }

  public async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    if (!this.isConnected) return null

    const { prefix = '' } = options
    const fullKey = this.createKey(prefix, key)
    
    try {
      const value = await this.client.get(fullKey)
      if (!value) return null

      const parsed = JSON.parse(value)
      return parsed.data
    } catch (error) {
      console.error(`Failed to get cache for key ${key}:`, error)
      return null
    }
  }

  public async del(key: string, options: CacheOptions = {}): Promise<void> {
    if (!this.isConnected) return

    const { prefix = '' } = options
    const fullKey = this.createKey(prefix, key)
    
    try {
      await this.client.del(fullKey)
    } catch (error) {
      console.error(`Failed to delete cache for key ${key}:`, error)
    }
  }

  public async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    if (!this.isConnected) return false

    const { prefix = '' } = options
    const fullKey = this.createKey(prefix, key)
    
    try {
      return (await this.client.exists(fullKey)) === 1
    } catch (error) {
      console.error(`Failed to check cache existence for key ${key}:`, error)
      return false
    }
  }

  // Specialized cache methods for different data types

  // Feed caching
  public async setFeedCache(
    userId: string, 
    feedData: FeedCacheData, 
    options: CacheOptions = {}
  ): Promise<void> {
    await this.set(
      `${KEY_PREFIXES.FEED}${userId}`,
      feedData,
      { ...options, ttl: TTL.USER_FEED, prefix: KEY_PREFIXES.FEED }
    )
  }

  public async getFeedCache(userId: string): Promise<FeedCacheData | null> {
    return this.get<FeedCacheData>(`${KEY_PREFIXES.FEED}${userId}`, { prefix: KEY_PREFIXES.FEED })
  }

  // Trending mixes caching
  public async setTrendingCache(
    genre: string, 
    trendingData: any[], 
    cursor: string | null = null
  ): Promise<void> {
    const cacheKey = `${KEY_PREFIXES.TRENDING}${genre || 'all'}`
    await this.set(cacheKey, {
      data: trendingData,
      cursor,
      timestamp: Date.now()
    }, { ttl: TTL.TRENDING_MIXES })
  }

  public async getTrendingCache(genre: string = 'all'): Promise<{ data: any[], cursor: string | null } | null> {
    const cacheKey = `${KEY_PREFIXES.TRENDING}${genre}`
    const cached = await this.get<{ data: any[], cursor: string | null }>(cacheKey)
    
    if (!cached) return null
    
    // Check if cache is still fresh (less than 10 minutes old)
    const age = (Date.now() - cached.timestamp) / 1000
    if (age > TTL.TRENDING_MIXES) {
      await this.del(cacheKey)
      return null
    }
    
    return cached
  }

  // User stats caching
  public async setUserStatsCache(userId: string, stats: StatsCacheData): Promise<void> {
    await this.set(
      `${KEY_PREFIXES.STATS}${userId}`,
      stats,
      { ttl: TTL.USER_STATS }
    )
  }

  public async getUserStatsCache(userId: string): Promise<StatsCacheData | null> {
    return this.get<StatsCacheData>(`${KEY_PREFIXES.STATS}${userId}`)
  }

  // Notification caching
  public async setNotificationsCache(userId: string, notifications: any[]): Promise<void> {
    await this.set(
      `${KEY_PREFIXES.NOTIFICATION}${userId}`,
      notifications,
      { ttl: TTL.NOTIFICATIONS }
    )
  }

  public async getNotificationsCache(userId: string): Promise<any[] | null> {
    return this.get<any[]>(`${KEY_PREFIXES.NOTIFICATION}${userId}`)
  }

  // Rate limiting
  public async incrementRateLimit(key: string, limit: number, window: number): Promise<{
    current: number
    limit: number
    remaining: number
    reset: number
  }> {
    if (!this.isConnected) {
      return {
        current: 0,
        limit,
        remaining: limit,
        reset: Date.now() + window * 1000
      }
    }

    const rateLimitKey = `${KEY_PREFIXES.RATE_LIMIT}${key}`
    const now = Date.now()
    const resetTime = now + window * 1000

    try {
      // Remove expired keys
      await this.client.zremrangebyscore(rateLimitKey, 0, now - window * 1000)
      
      // Add current request
      await this.client.zadd(rateLimitKey, now, `${now}-${Math.random()}`)
      
      // Set expiration
      await this.client.expire(rateLimitKey, window)
      
      // Get current count
      const current = await this.client.zcard(rateLimitKey)
      
      return {
        current,
        limit,
        remaining: Math.max(0, limit - current),
        reset: resetTime
      }
    } catch (error) {
      console.error('Rate limiting error:', error)
      return {
        current: 0,
        limit,
        remaining: limit,
        reset: resetTime
      }
    }
  }

  // Cache invalidation
  public async invalidateUserCache(userId: string): Promise<void> {
    const patterns = [
      `${KEY_PREFIXES.FEED}${userId}*`,
      `${KEY_PREFIXES.STATS}${userId}*`,
      `${KEY_PREFIXES.NOTIFICATION}${userId}*`
    ]

    for (const pattern of patterns) {
      try {
        const keys = await this.client.keys(pattern)
        if (keys.length > 0) {
          await this.client.del(...keys)
        }
      } catch (error) {
        console.error(`Failed to invalidate cache for pattern ${pattern}:`, error)
      }
    }
  }

  public async invalidateMixCache(mixId: string): Promise<void> {
    try {
      // Invalidate related feeds that might contain this mix
      const feedKeys = await this.client.keys(`${KEY_PREFIXES.FEED}*`)
      for (const key of feedKeys) {
        // In a real implementation, you'd check if the cache contains this mix
        // For now, just invalidate all feeds
        await this.client.del(key)
      }
    } catch (error) {
      console.error(`Failed to invalidate mix cache for mix ${mixId}:`, error)
    }
  }

  // Health check
  public async healthCheck(): Promise<{
    connected: boolean
    latency: number
    memoryUsage: string
    keyCount: number
  }> {
    if (!this.isConnected) {
      return {
        connected: false,
        latency: 0,
        memoryUsage: 'N/A',
        keyCount: 0
      }
    }

    try {
      const latency = await this.client.ping()
      const info = await this.client.info('memory')
      const keyCount = await this.client.dbsize()
      
      return {
        connected: true,
        latency: parseInt(latency),
        memoryUsage: info || 'N/A',
        keyCount
      }
    } catch (error) {
      console.error('Redis health check failed:', error)
      return {
        connected: false,
        latency: 0,
        memoryUsage: 'N/A',
        keyCount: 0
      }
    }
  }
}

// Global instance
export const redisCache = new RedisCache()

// Utility functions for cache management
export const cacheUtils = {
  // Generate cache key with user context
  userKey: (userId: string, suffix: string): string => `${KEY_PREFIXES.USER}${userId}:${suffix}`,
  
  // Generate cache key with mix context
  mixKey: (mixId: string, suffix: string): string => `${KEY_PREFIXES.MIX}${mixId}:${suffix}`,
  
  // Check if cache is fresh
  isCacheFresh: (timestamp: number, ttl: number): boolean => {
    const age = (Date.now() - timestamp) / 1000
    return age < ttl
  },
  
  // Invalidate cache for multiple keys
  invalidateMultiple: async (keys: string[]): Promise<void> => {
    if (!redisCache.isHealthy()) return
    
    try {
      await redisCache.client.del(...keys)
    } catch (error) {
      console.error('Failed to invalidate multiple cache keys:', error)
    }
  }
}

// Initialize connection on module load
if (typeof window === 'undefined') {
  // Server-side initialization
  redisCache.connect().catch(console.error)
}