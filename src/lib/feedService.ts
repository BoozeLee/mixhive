import { supabase } from './supabase'
import { redisCache, FeedCacheData } from './redis'
import { realtimeManager } from './websocket'
import { getTrending, getRecentMixes, getMixedFollowingFeed } from './api'
import type { FeedMix, FeedCursor, TrendingCursor, MixedFeedResult } from './types'

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
    isNew?: boolean
    isTrending?: boolean
    genre?: string
    dj?: {
      id: string
      username: string
      display_name: string
      avatar_url: string
    }
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
    const cachedFeed = await this.getCachedFeed(cacheKey)
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
      case 'trending':
        const trendingResult = await this.getTrendingWithCache(genre, limit, cursor as TrendingCursor)
        freshData = trendingResult.data.map(this.enhanceFeedItem)
        newCursor = trendingResult.cursor
        hasMore = !!trendingResult.cursor
        break

      case 'latest':
        const latestResult = await this.getRecentMixesWithCache(limit, cursor as FeedCursor)
        freshData = latestResult.data.map(this.enhanceFeedItem)
        newCursor = latestResult.cursor
        hasMore = !!latestResult.cursor
        break

      case 'following':
        if (!userId) {
          throw new Error('User ID required for following feed')
        }
        const followingResult = await this.getMixedFollowingFeedWithCache(userId, limit, cursor as FeedCursor)
        freshData = followingResult.data.map(item => ({
          ...this.enhanceFeedItem(item.data),
          type: item.type
        }))
        newCursor = followingResult.mixCursor || followingResult.buzzCursor
        hasMore = !!(followingResult.mixCursor || followingResult.buzzCursor)
        break

      case 'discover':
        const discoverResult = await this.getDiscoverFeedWithCache(userId, genre, limit, cursor)
        freshData = discoverResult
        break

      default:
        throw new Error(`Unknown feed type: ${type}`)
    }

    // Cache the fresh data
    await this.setCachedFeed(cacheKey, {
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

  private async getCachedFeed(cacheKey: string): Promise<{
    items: EnhancedFeedItem[]
    cursor: string | null
    hasMore: boolean
    timestamp: number
  } | null> {
    try {
      const cached = await redisCache.get<FeedCacheData>(cacheKey)
      if (!cached) return null

      // Check if cache is still fresh
      const age = (Date.now() - cached.timestamp) / 1000
      const ttl = this.getTTLForFeedType(cacheKey)
      
      if (age > ttl) {
        await redisCache.del(cacheKey)
        return null
      }

      return {
        items: cached.data,
        cursor: cached.cursor,
        hasMore: !!cached.cursor,
        timestamp: cached.timestamp
      }
    } catch (error) {
      console.error('Failed to get cached feed:', error)
      return null
    }
  }

  private async setCachedFeed(cacheKey: string, data: FeedCacheData): Promise<void> {
    try {
      const ttl = this.getTTLForFeedType(cacheKey)
      await redisCache.set(cacheKey, data, { ttl })
    } catch (error) {
      console.error('Failed to cache feed:', error)
    }
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

  private async getDiscoverFeedWithCache(userId: string, genre?: string, limit = 20, cursor?: string) {
    // Combine trending and recommended mixes
    const [trending, recommended] = await Promise.all([
      getTrending(limit / 2, undefined, genre),
      this.getRecommendedMixes(userId, limit / 2)
    ])

    // Remove duplicates and merge
    const allMixes = [...trending.data, ...recommended]
    const uniqueMixes = this.deduplicateMixes(allMixes)

    return uniqueMixes.slice(0, limit).map(this.enhanceFeedItem)
  }

  private async getRecommendedMixes(userId: string, limit = 10): Promise<FeedMix[]> {
    // This would use a recommendation algorithm in a real implementation
    // For now, return trending mixes with a different scoring system
    return getTrending(limit)
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
    const isNew = (now.getTime() - createdAt.getTime()) < 24 * 60 * 60 * 1000 // 24 hours

    return {
      id: mix.id,
      type: 'mix',
      data: mix,
      timestamp: mix.created_at,
      score: this.calculateFeedScore(mix),
      metadata: {
        isNew,
        isTrending: this.isTrending(mix),
        genre: mix.genre_name,
        dj: mix.dj ? {
          id: mix.dj.id,
          username: mix.dj.username,
          display_name: mix.dj.display_name || mix.dj.username,
          avatar_url: mix.dj.avatar_url
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

  // Real-time feed update methods
  async addRealTimeUpdate(userId: string, update: EnhancedFeedItem): Promise<void> {
    try {
      // Add to user's personal feed cache
      const cacheKey = this.generateCacheKey('following', userId)
      const cached = await this.getCachedFeed(cacheKey)
      
      if (cached) {
        const updatedItems = [update, ...cached.items].slice(0, 50) // Keep last 50 items
        await this.setCachedFeed(cacheKey, {
          data: updatedItems,
          cursor: null,
          timestamp: Date.now()
        })
      }

      // Broadcast via WebSocket
      await realtimeManager.broadcastMixUpdate({
        type: 'new_mix',
        data: update.data,
        mixId: update.id,
        userId
      })

    } catch (error) {
      console.error('Failed to add real-time update:', error)
    }
  }

  async invalidateUserFeed(userId: string): Promise<void> {
    try {
      const patterns = [
        `feed:*:${userId}:*`,
        `feed:following:${userId}:*`,
        `feed:discover:${userId}:*`
      ]

      for (const pattern of patterns) {
        const keys = await redisCache.client.keys(pattern)
        if (keys.length > 0) {
          await redisCache.client.del(...keys)
        }
      }
    } catch (error) {
      console.error('Failed to invalidate user feed:', error)
    }
  }
}

// Global feed service instance
export const feedService = new FeedService()