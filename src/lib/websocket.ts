import { createClient, RealtimeChannel } from '@supabase/supabase-js'
import { isSupabaseConfigured } from './supabase'

export interface RealtimeEvent {
  type: 'mix_upload' | 'like' | 'comment' | 'follow' | 'repost' | 'notification'
  payload: any
  timestamp: string
}

export interface FeedUpdate {
  type: 'new_mix' | 'update_mix' | 'new_comment' | 'like_update'
  data: any
  mixId?: string
  userId?: string
}

export class RealtimeFeedManager {
  private supabase: any
  private channels: Map<string, RealtimeChannel> = new Map()
  private subscriptions: Map<string, ((event: RealtimeEvent) => void)[]> = new Map()

  constructor() {
    if (isSupabaseConfigured) {
      this.supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          realtime: {
            params: {
              eventsPerSecond: 10
            }
          }
        }
      )
    }
  }

  /**
   * Subscribe to a user's personal feed for real-time updates
   */
  async subscribeToFeed(userId: string, callback: (event: FeedUpdate) => void): Promise<void> {
    if (!this.supabase) return

    const channelName = `user:${userId}:feed`
    
    // Remove existing channel if it exists
    if (this.channels.has(channelName)) {
      this.channels.get(channelName)?.unsubscribe()
    }

    const channel = this.supabase
      .channel(channelName)
      .on('broadcast', { event: 'feed_update' }, (payload) => {
        const event: FeedUpdate = payload.payload
        callback(event)
      })
      .subscribe((status) => {
        console.log(`Feed subscription for ${userId}:`, status)
      })

    this.channels.set(channelName, channel)
    
    // Store callback
    if (!this.subscriptions.has(userId)) {
      this.subscriptions.set(userId, [])
    }
    this.subscriptions.get(userId)!.push(callback)
  }

  /**
   * Subscribe to notifications for a user
   */
  async subscribeToNotifications(userId: string, callback: (event: RealtimeEvent) => void): Promise<void> {
    if (!this.supabase) return

    const channelName = `user:${userId}:notifications`
    
    if (this.channels.has(channelName)) {
      this.channels.get(channelName)?.unsubscribe()
    }

    const channel = this.supabase
      .channel(channelName)
      .on('broadcast', { event: 'notification' }, (payload) => {
        const event: RealtimeEvent = payload.payload
        callback(event)
      })
      .subscribe((status) => {
        console.log(`Notification subscription for ${userId}:`, status)
      })

    this.channels.set(channelName, channel)
    
    if (!this.subscriptions.has(`${userId}:notifications`)) {
      this.subscriptions.set(`${userId}:notifications`, [])
    }
    this.subscriptions.get(`${userId}:notifications`)!.push(callback)
  }

  /**
   * Subscribe to real-time comments for a specific mix
   */
  async subscribeToMixComments(mixId: string, callback: (event: RealtimeEvent) => void): Promise<void> {
    if (!this.supabase) return

    const channelName = `mix:${mixId}:comments`
    
    if (this.channels.has(channelName)) {
      this.channels.get(channelName)?.unsubscribe()
    }

    const channel = this.supabase
      .channel(channelName)
      .on('broadcast', { event: 'new_comment' }, (payload) => {
        const event: RealtimeEvent = payload.payload
        callback(event)
      })
      .subscribe((status) => {
        console.log(`Comment subscription for mix ${mixId}:`, status)
      })

    this.channels.set(channelName, channel)
  }

  /**
   * Broadcast a new mix upload to relevant users
   */
  async broadcastMixUpload(mixData: any): Promise<void> {
    if (!this.supabase) return

    // Broadcast to followers
    await this.supabase.channel('mix_uploads').send({
      type: 'broadcast',
      event: 'mix_upload',
      payload: {
        type: 'mix_upload',
        payload: mixData,
        timestamp: new Date().toISOString()
      }
    })

    // Also trigger real-time feed updates
    await this.supabase.channel('feed_updates').send({
      type: 'broadcast',
      event: 'feed_update',
      payload: {
        type: 'new_mix',
        data: mixData,
        mixId: mixData.id,
        timestamp: new Date().toISOString()
      }
    })
  }

  /**
   * Broadcast a new comment
   */
  async broadcastComment(commentData: any): Promise<void> {
    if (!this.supabase) return

    await this.supabase.channel('mix_comments').send({
      type: 'broadcast',
      event: 'new_comment',
      payload: {
        type: 'comment',
        payload: commentData,
        timestamp: new Date().toISOString()
      }
    })
  }

  /**
   * Broadcast a notification
   */
  async broadcastNotification(notificationData: any): Promise<void> {
    if (!this.supabase) return

    await this.supabase.channel('user_notifications').send({
      type: 'broadcast',
      event: 'notification',
      payload: {
        type: 'notification',
        payload: notificationData,
        timestamp: new Date().toISOString()
      }
    })
  }

  /**
   * Unsubscribe from all channels for a user
   */
  async unsubscribeUser(userId: string): Promise<void> {
    const feedChannel = this.channels.get(`user:${userId}:feed`)
    const notificationChannel = this.channels.get(`user:${userId}:notifications`)
    
    if (feedChannel) {
      feedChannel.unsubscribe()
      this.channels.delete(`user:${userId}:feed`)
    }
    
    if (notificationChannel) {
      notificationChannel.unsubscribe()
      this.channels.delete(`user:${userId}:notifications`)
    }

    // Clear subscriptions
    this.subscriptions.delete(userId)
    this.subscriptions.delete(`${userId}:notifications`)
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): { connected: boolean; channels: number } {
    return {
      connected: this.supabase !== undefined,
      channels: this.channels.size
    }
  }
}

// Global instance
export const realtimeManager = new RealtimeFeedManager()

/**
 * Hook for using real-time updates in React components
 */
export function useRealtimeFeed(userId: string) {
  const [mixUpdates, setMixUpdates] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [comments, setComments] = useState<any[]>([])

  useEffect(() => {
    if (!userId || !realtimeManager.getConnectionStatus().connected) return

    // Subscribe to feed updates
    realtimeManager.subscribeToFeed(userId, (event: FeedUpdate) => {
      if (event.type === 'new_mix') {
        setMixUpdates(prev => [event.data, ...prev].slice(0, 10))
      } else if (event.type === 'new_comment') {
        setComments(prev => [event.data, ...prev].slice(0, 20))
      }
    })

    // Subscribe to notifications
    realtimeManager.subscribeToNotifications(userId, (event: RealtimeEvent) => {
      setNotifications(prev => [event.payload, ...prev].slice(0, 10))
    })

    return () => {
      // Cleanup on unmount
      realtimeManager.unsubscribeUser(userId)
    }
  }, [userId])

  return {
    mixUpdates,
    notifications,
    comments,
    isConnected: realtimeManager.getConnectionStatus().connected
  }
}