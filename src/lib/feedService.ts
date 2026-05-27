import { getTrending, getRecentMixes, getMixedFollowingFeed } from './api'
import type { FeedMix, FeedCursor, TrendingCursor } from './types'

// Lightweight in-memory feed cache (TTL-based, cleared on page reload)
const _memCache = new Map<string, { data: unknown; expires: number }>()

export interface FeedOptions {
  type: 'trending' | 'latest' | 'following' | 'discover'
  userId?: string
  genre?: string
  limit?: number
  cursor?: string
}

export interface EnhancedFeedItem {
  id: string
  type: 'mix' | 'buzz'
  data: any
  timestamp: string
  score?: number
  metadata?: {
    isNew?: boolean | undefined
    isTrending?: boolean | undefined
    genre?: string | undefined
    dj?: {
      id: string
      username: string
      display_name: string
      avatar_url: string
    } | undefined
  }
}

class FeedService {
  private readonly CACHE_TTL = {
    TRENDING: 600, // 10 minutes
    LATEST: 300, // 5 minutes
    FOLLOWING: 60, // 1 minute
    DISCOVER: 1800 // 30 minutes
  }

  async getFeed(options: FeedOptions): Promise<{
    items: EnhancedFeedItem[]
    cursor: string | null
    hasMore: boolean
    cacheHit: boolean
  }> {
    const { type, userId, genre, limit = 20, cursor } = options
    
    // Generate cache key
    const cacheKey = this.generateCacheKey(type, userId, genre, cursor)
    
    // Try to get from cache first
    const cachedFeed = this.getCachedFeed(cacheKey)
    if (cachedFeed) {
      return {
        items: cachedFeed.items,
        cursor: cachedFeed.cursor,
        hasMore: cachedFeed.hasMore,
        cacheHit: true
      }
    }

    // Fetch fresh data
    let freshData: any[] = []
    let newCursor: string | null = null
    let hasMore = false

    switch (type) {
      case 'trending': {
        const trendingCursor = cursor ? (JSON.parse(cursor) as TrendingCursor) : undefined
        const trendingResult = await this.getTrendingWithCache(genre, limit, trendingCursor)
        freshData = trendingResult.data.map(this.enhanceFeedItem)
        newCursor = trendingResult.cursor ? JSON.stringify(trendingResult.cursor) : null
        hasMore = !!trendingResult.cursor
        break
      }

      case 'latest': {
        const latestCursor = cursor ? (JSON.parse(cursor) as FeedCursor) : undefined
        const latestResult = await this.getRecentMixesWithCache(limit, latestCursor)
        freshData = latestResult.data.map(this.enhanceFeedItem)
        newCursor = latestResult.cursor ? JSON.stringify(latestResult.cursor) : null
        hasMore = !!latestResult.cursor
        break
      }

      case 'following': {
        if (!userId) {
          throw new Error('User ID required for following feed')
        }
        const followingCursor = cursor ? (JSON.parse(cursor) as FeedCursor) : undefined
        const followingResult = await this.getMixedFollowingFeedWithCache(userId, limit, followingCursor)
        freshData = followingResult.data.map(item => {
          if (item.type === 'mix') return this.enhanceFeedItem(item.data)
          return { id: item.data.id, type: 'buzz' as const, data: item.data, timestamp: item.data.created_at }
        })
        newCursor = followingResult.mixCursor ? JSON.stringify(followingResult.mixCursor) : followingResult.buzzCursor ? JSON.stringify(followingResult.buzzCursor) : null
        hasMore = !!(followingResult.mixCursor || followingResult.buzzCursor)
        break
      }

      case 'discover': {
        const discoverResult = await this.getDiscoverFeedWithCache(userId, genre, limit, cursor)
        freshData = discoverResult
        break
      }

      default:
        throw new Error(`Unknown feed type: ${type}`)
    }

    // Cache the fresh data
    this.setCachedFeed(cacheKey, {
      items: freshData,
      cursor: newCursor,
      hasMore,
      timestamp: Date.now()
    })

    return {
      items: freshData,
      cursor: newCursor,
      hasMore,
      cacheHit: false
    }
  }

  private generateCacheKey(type: string, userId?: string, genre?: string, cursor?: string): string {
    const parts = ['feed', type]
    if (userId) parts.push(userId)
    if (genre) parts.push(genre)
    if (cursor) parts.push(cursor)
    return parts.join(':')
  }

  private getCachedFeed(cacheKey: string): {
    items: EnhancedFeedItem[]
    cursor: string | null
    hasMore: boolean
    timestamp: number
  } | null {
    const entry = _memCache.get(cacheKey)
    if (!entry || Date.now() > entry.expires) {
      _memCache.delete(cacheKey)
      return null
    }
    return entry.data as ReturnType<FeedService['getCachedFeed']>
  }

  private setCachedFeed(cacheKey: string, data: { items: EnhancedFeedItem[]; cursor: string | null; hasMore: boolean; timestamp: number }): void {
    const ttl = this.getTTLForFeedType(cacheKey) * 1000
    _memCache.set(cacheKey, { data, expires: Date.now() + ttl })
  }

  private getTTLForFeedType(cacheKey: string): number {
    if (cacheKey.includes('trending')) return this.CACHE_TTL.TRENDING
    if (cacheKey.includes('latest')) return this.CACHE_TTL.LATEST
    if (cacheKey.includes('following')) return this.CACHE_TTL.FOLLOWING
    return this.CACHE_TTL.DISCOVER
  }

  private async getTrendingWithCache(genre?: string, limit = 20, cursor?: TrendingCursor) {
    return getTrending(limit, cursor, genre)
  }

  private async getRecentMixesWithCache(limit = 20, cursor?: FeedCursor) {
    return getRecentMixes(limit, cursor)
  }

  private async getMixedFollowingFeedWithCache(userId: string, limit = 20, cursor?: FeedCursor) {
    return getMixedFollowingFeed(userId, limit, cursor)
  }

  private async getDiscoverFeedWithCache(_userId: string | undefined, genre?: string, limit = 20, _cursor?: string) {
    const [trending, recommended] = await Promise.all([
      getTrending(limit / 2, undefined, genre),
      this.getRecommendedMixes(limit / 2)
    ])
    const allMixes = [...trending.data, ...recommended]
    const uniqueMixes = this.deduplicateMixes(allMixes)
    return uniqueMixes.slice(0, limit).map(m => this.enhanceFeedItem(m))
  }

  private async getRecommendedMixes(limit = 10): Promise<FeedMix[]> {
    const result = await getTrending(limit)
    return result.data
  }

  private deduplicateMixes(mixes: FeedMix[]): FeedMix[] {
    const seen = new Set()
    return mixes.filter(mix => {
      if (seen.has(mix.id)) return false
      seen.add(mix.id)
      return true
    })
  }

  private enhanceFeedItem(mix: FeedMix): EnhancedFeedItem {
    const now = new Date()
    const createdAt = new Date(mix.created_at)
    const isNew = (now.getTime() - createdAt.getTime()) < 24 * 60 * 60 * 1000

    return {
      id: mix.id,
      type: 'mix',
      data: mix,
      timestamp: mix.created_at,
      score: this.calculateFeedScore(mix),
      metadata: {
        isNew,
        isTrending: this.isTrending(mix),
        genre: mix.genre_name ?? undefined,
        dj: mix.dj ? {
          id: mix.dj.id,
          username: mix.dj.username,
          display_name: mix.dj.display_name ?? mix.dj.username,
          avatar_url: mix.dj.avatar_url ?? ''
        } : undefined
      }
    }
  }

  private calculateFeedScore(mix: FeedMix): number {
    const playWeight = (mix.play_count || 0) * 0.1
    const likeWeight = (mix.like_count || 0) * 1.0
    const commentWeight = (mix.comment_count || 0) * 2.0
    const recencyWeight = this.getRecencyScore(mix.created_at)
    
    return playWeight + likeWeight + commentWeight + recencyWeight
  }

  private getRecencyScore(timestamp: string): number {
    const now = new Date()
    const created = new Date(timestamp)
    const hoursDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60)
    
    if (hoursDiff < 1) return 10 // Last hour
    if (hoursDiff < 24) return 5 // Last day
    if (hoursDiff < 72) return 2 // Last 3 days
    return 1 // Older
  }

  private isTrending(mix: FeedMix): boolean {
    const score = this.calculateFeedScore(mix)
    return score > 50 // Threshold for trending
  }

  addRealTimeUpdate(userId: string, update: EnhancedFeedItem): void {
    const cacheKey = this.generateCacheKey('following', userId)
    const cached = this.getCachedFeed(cacheKey)
    if (cached) {
      const updatedItems = [update, ...cached.items].slice(0, 50)
      this.setCachedFeed(cacheKey, { items: updatedItems, cursor: null, hasMore: false, timestamp: Date.now() })
    }
  }

  invalidateUserFeed(userId: string): void {
    for (const key of _memCache.keys()) {
      if (key.includes(userId)) _memCache.delete(key)
    }
  }
}

// Global feed service instance
export const feedService = new FeedService()