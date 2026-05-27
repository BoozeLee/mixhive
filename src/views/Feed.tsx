import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { getTrending, getMixedFollowingFeed, getLatestMixed } from '../lib/api'
import { feedService } from '../lib/feedService'
import { useRealtime } from '../hooks/useRealtime'
import { MixCard } from '../components/MixCard'
import { BuzzCard } from '../components/BuzzCard'
import { BuzzComposer } from '../components/BuzzComposer'
import { RecommendedDJs } from '../components/RecommendedDJs'
import { SkeletonFeed } from '../components/Skeleton'
import type { FeedMix, FeedCursor, TrendingCursor, FeedItem, MixedFeedResult, Buzz } from '../lib/types'

type Tab = 'feed' | 'trending' | 'latest'

interface MixTabState {
  data: FeedMix[]
  cursor: TrendingCursor | null
  hasMore: boolean
  loading: boolean
}

interface MixedTabState {
  data: FeedItem[]
  mixCursor: FeedCursor | null
  buzzCursor: FeedCursor | null
  hasMore: boolean
  loading: boolean
}

const emptyMixTab = (): MixTabState => ({ data: [], cursor: null, hasMore: true, loading: true })
const emptyMixedTab = (): MixedTabState => ({ data: [], mixCursor: null, buzzCursor: null, hasMore: true, loading: true })

export function Feed() {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState<Tab>('trending')
  const [mixedFeed, setMixedFeed] = useState<MixedTabState>(emptyMixedTab())
  const [latestMixed, setLatestMixed] = useState<MixedTabState>(emptyMixedTab())
  const [trendingTab, setTrendingTab] = useState<MixTabState>(emptyMixTab())
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [realtimeUpdates, setRealtimeUpdates] = useState<FeedItem[]>([])
  const loadingMoreRef = useRef(false)
  const initializedRef = useRef(false)
  const [newCount, setNewCount] = useState(0)

  // Use real-time updates
  const { mixUpdates, notifications, isConnected } = useRealtime(user?.id, {
    enableMixUpdates: true,
    enableNotifications: true
  })

  const fetchFollowingFeed = useCallback(async (mixCursor?: FeedCursor, buzzCursor?: FeedCursor): Promise<MixedFeedResult> => {
    if (!user) return { data: [], mixCursor: null, buzzCursor: null }
    return getMixedFollowingFeed(user.id, 20, mixCursor, buzzCursor)
  }, [user])

  // Load feed based on current tab
  const loadFeed = useCallback(async () => {
    if (!user || loading) return

    setLoading(true)
    try {
      let result
      switch (tab) {
        case 'trending':
          result = await feedService.getFeed({
            type: 'trending',
            limit: 20,
            genre: undefined
          })
          setTrendingTab({ data: result.items as FeedMix[], cursor: result.cursor as TrendingCursor, hasMore: result.hasMore, loading: false })
          break

        case 'latest':
          result = await feedService.getFeed({
            type: 'latest',
            limit: 20
          })
          setLatestMixed({ 
            data: result.items as FeedItem[], 
            mixCursor: result.cursor as FeedCursor, 
            buzzCursor: null, 
            hasMore: result.hasMore, 
            loading: false 
          })
          break

        case 'feed':
        default:
          result = await feedService.getFeed({
            type: 'following',
            userId: user.id,
            limit: 20
          })
          setMixedFeed({ 
            data: result.items as FeedItem[], 
            mixCursor: result.cursor as FeedCursor, 
            buzzCursor: null, 
            hasMore: result.hasMore, 
            loading: false 
          })
          break
      }
    } catch (error) {
      console.error('Failed to load feed:', error)
    } finally {
      setLoading(false)
    }
  }, [tab, user, loading])

  // Initial load and tab changes
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      loadFeed()
    } else {
      loadFeed()
    }
  }, [tab, user, loadFeed])

  // Handle real-time updates
  useEffect(() => {
    if (!user || !mixUpdates.length) return

    // Add new real-time updates to the top of the feed
    const newItems = mixUpdates.map(update => ({
      type: 'mix' as const,
      data: update.data,
      id: update.mixId || update.data.id,
      created_at: update.timestamp
    }))

    setFeedItems(prev => [...newItems, ...prev].slice(0, 100)) // Keep last 100 items
    setNewCount(prev => prev + mixUpdates.length)
  }, [mixUpdates, user])

  // Tab switch — load if the current tab has no data yet and isn't already loading.
  // The `loading` guard prevents setState → re-run → setState loops when the
  // state objects are in the deps array.
  useEffect(() => {
    if (!initializedRef.current) return
    if (tab === 'feed') {
      if (mixedFeed.data.length > 0 || !mixedFeed.hasMore || mixedFeed.loading) return
      if (!user) return
      setMixedFeed(prev => ({ ...prev, loading: true }))
      fetchFollowingFeed().then(res => {
        setMixedFeed({ data: res.data, mixCursor: res.mixCursor, buzzCursor: res.buzzCursor, hasMore: !!(res.mixCursor || res.buzzCursor), loading: false })
      }).catch(() => {
        setMixedFeed(prev => ({ ...prev, loading: false }))
      })
      return
    }
    if (tab === 'latest') {
      if (latestMixed.data.length > 0 || !latestMixed.hasMore || latestMixed.loading) return
      setLatestMixed(prev => ({ ...prev, loading: true }))
      getLatestMixed(20).then(res => {
        setLatestMixed({ data: res.data, mixCursor: res.mixCursor, buzzCursor: res.buzzCursor, hasMore: !!(res.mixCursor || res.buzzCursor), loading: false })
      }).catch(() => {
        setLatestMixed(prev => ({ ...prev, loading: false }))
      })
      return
    }
    // trending
    if (trendingTab.data.length > 0 || !trendingTab.hasMore || trendingTab.loading) return
    setTrendingTab(prev => ({ ...prev, loading: true }))
    getTrending(20).then(res => {
      setTrendingTab({ data: res.data, cursor: res.cursor as TrendingCursor | null, hasMore: !!res.cursor, loading: false })
    }).catch(() => {
      setTrendingTab(prev => ({ ...prev, loading: false }))
    })
  }, [tab, user, fetchFollowingFeed, latestMixed, trendingTab, mixedFeed])

  // Realtime: count feed events landing for this user. When the user
  // clicks the "show N new mixes" pill, we re-fetch the following tab.
  useEffect(() => {
    if (!isSupabaseConfigured || !user) return
    const channel = supabase
      .channel(`feed:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'feed_events', filter: `target_id=eq.${user.id}` },
        (payload: { new: Record<string, unknown> }) => {
          if (payload.new?.actor_id !== user.id) setNewCount(c => c + 1)
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  const handleShowNew = async () => {
    if (!user) return
    setNewCount(0)
    setTab('feed')
    const res = await fetchFollowingFeed()
    setMixedFeed({ data: res.data, mixCursor: res.mixCursor, buzzCursor: res.buzzCursor, hasMore: !!(res.mixCursor || res.buzzCursor), loading: false })
  }

  const handleLoadMore = async () => {
    if (loadingMoreRef.current) return
    loadingMoreRef.current = true

    if (tab === 'feed') {
      if (!mixedFeed.mixCursor && !mixedFeed.buzzCursor) { loadingMoreRef.current = false; return }
      setMixedFeed(prev => ({ ...prev, loading: true }))
      try {
        const res = await fetchFollowingFeed(mixedFeed.mixCursor ?? undefined, mixedFeed.buzzCursor ?? undefined)
        setMixedFeed(prev => ({
          data: [...prev.data, ...res.data],
          mixCursor: res.mixCursor,
          buzzCursor: res.buzzCursor,
          hasMore: !!(res.mixCursor || res.buzzCursor),
          loading: false,
        }))
      } catch {
        setMixedFeed(prev => ({ ...prev, loading: false }))
      } finally {
        loadingMoreRef.current = false
      }
      return
    }

    if (tab === 'latest') {
      if (!latestMixed.mixCursor && !latestMixed.buzzCursor) { loadingMoreRef.current = false; return }
      setLatestMixed(prev => ({ ...prev, loading: true }))
      try {
        const res = await getLatestMixed(20, latestMixed.mixCursor ?? undefined, latestMixed.buzzCursor ?? undefined)
        setLatestMixed(prev => ({
          data: [...prev.data, ...res.data],
          mixCursor: res.mixCursor,
          buzzCursor: res.buzzCursor,
          hasMore: !!(res.mixCursor || res.buzzCursor),
          loading: false,
        }))
      } catch {
        setLatestMixed(prev => ({ ...prev, loading: false }))
      } finally {
        loadingMoreRef.current = false
      }
      return
    }

    // trending
    if (!trendingTab.cursor) { loadingMoreRef.current = false; return }
    setTrendingTab(prev => ({ ...prev, loading: true }))
    try {
      const res = await getTrending(20, trendingTab.cursor ?? undefined)
      setTrendingTab(prev => ({
        data: [...prev.data, ...res.data],
        cursor: res.cursor as TrendingCursor | null,
        hasMore: !!res.cursor,
        loading: false,
      }))
    } catch {
      setTrendingTab(prev => ({ ...prev, loading: false }))
    } finally {
      loadingMoreRef.current = false
    }
  }

  const handleRetry = async (t: Tab) => {
    if (t === 'feed') {
      setMixedFeed(prev => ({ ...prev, loading: true }))
      try {
        const res = await fetchFollowingFeed()
        setMixedFeed({ data: res.data, mixCursor: res.mixCursor, buzzCursor: res.buzzCursor, hasMore: !!(res.mixCursor || res.buzzCursor), loading: false })
      } catch {
        setMixedFeed(prev => ({ ...prev, loading: false }))
      }
      return
    }
    if (t === 'latest') {
      setLatestMixed(prev => ({ ...prev, loading: true }))
      try {
        const res = await getLatestMixed(20)
        setLatestMixed({ data: res.data, mixCursor: res.mixCursor, buzzCursor: res.buzzCursor, hasMore: !!(res.mixCursor || res.buzzCursor), loading: false })
      } catch {
        setLatestMixed(prev => ({ ...prev, loading: false }))
      }
      return
    }
    setTrendingTab(prev => ({ ...prev, loading: true }))
    try {
      const res = await getTrending(20)
      setTrendingTab({ data: res.data, cursor: res.cursor as TrendingCursor | null, hasMore: !!res.cursor, loading: false })
    } catch {
      setTrendingTab(prev => ({ ...prev, loading: false }))
    }
  }

  function handleBuzzCreated(buzz: Buzz) {
    const feedBuzz = { ...buzz, author: profile ?? undefined }
    setMixedFeed(prev => ({ ...prev, data: [{ type: 'buzz' as const, data: feedBuzz }, ...prev.data] }))
    setLatestMixed(prev => ({ ...prev, data: [{ type: 'buzz' as const, data: feedBuzz }, ...prev.data] }))
    if (tab !== 'feed' && tab !== 'latest') setNewCount(c => c + 1)
  }

  const currentData: FeedItem[] =
    tab === 'feed' ? mixedFeed.data :
    tab === 'latest' ? latestMixed.data :
    trendingTab.data.map(m => ({ type: 'mix' as const, data: m }))
  const currentLoading =
    tab === 'feed' ? mixedFeed.loading :
    tab === 'latest' ? latestMixed.loading :
    trendingTab.loading
  const currentHasMore =
    tab === 'feed' ? mixedFeed.hasMore :
    tab === 'latest' ? latestMixed.hasMore :
    trendingTab.hasMore

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      {/* Buzz composer — visible on all tabs so users can always post */}
      <BuzzComposer onBuzzCreated={handleBuzzCreated} />

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#111', borderRadius: 10, padding: 4 }}>
        {(['trending', 'latest', 'feed'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: tab === t ? '#f0c040' : 'transparent',
              color: tab === t ? '#0a0a0a' : '#666',
              fontWeight: tab === t ? 700 : 400,
              cursor: 'pointer',
              fontSize: 13,
              textTransform: 'capitalize'
            }}
          >
            {t === 'feed' ? 'Following' : t}
          </button>
        ))}
      </div>

      {user && newCount > 0 && tab !== 'feed' && (
        <button
          onClick={handleShowNew}
          style={{
            display: 'block',
            margin: '0 auto 16px',
            padding: '8px 18px',
            background: '#f0c040',
            color: '#0a0a0a',
            border: 'none',
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          ↑ Show {newCount} new
        </button>
      )}

      {user && <RecommendedDJs userId={user.id} />}

      {tab === 'feed' && !user && (
        <div style={{ textAlign: 'center', padding: 40, color: '#666', fontSize: 14 }}>
          Sign in to see your following feed
        </div>
      )}

      {currentLoading && currentData.length === 0 ? (
        <SkeletonFeed />
      ) : currentData.length === 0 && !currentLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#666', fontSize: 14 }}>
          {tab === 'feed' ? 'Follow some DJs to see their mixes and buzzes here' : 'Nothing yet'}
          <button
            onClick={() => handleRetry(tab)}
            style={{ marginTop: 16, padding: '8px 16px', background: '#f0c040', color: '#0a0a0a', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'block', margin: '16px auto 0' }}
          >
            Try Again
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {currentData.map(item =>
            item.type === 'buzz'
              ? <BuzzCard key={item.data.id} buzz={item.data} />
              : <MixCard key={item.data.id} mix={item.data} />
          )}
          {currentHasMore && (
            <button onClick={handleLoadMore} disabled={currentLoading}
              style={{
                marginTop: 12,
                padding: '10px 20px',
                background: currentLoading ? '#222' : '#111',
                border: '1px solid #333',
                color: '#888',
                borderRadius: 8,
                cursor: currentLoading ? 'default' : 'pointer',
                fontSize: 14,
              }}
            >
              {currentLoading ? 'Loading…' : 'Load More'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
