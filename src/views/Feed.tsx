import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { getTrending, getRecentMixes, getMixedFollowingFeed } from '../lib/api'
import { MixCard } from '../components/MixCard'
import { BuzzCard } from '../components/BuzzCard'
import { BuzzComposer } from '../components/BuzzComposer'
import { RecommendedDJs } from '../components/RecommendedDJs'
import { SkeletonFeed } from '../components/Skeleton'
import type { FeedMix, FeedCursor, TrendingCursor, FeedItem, MixedFeedResult, Buzz } from '../lib/types'

type Tab = 'feed' | 'trending' | 'latest'

interface MixTabState {
  data: FeedMix[]
  cursor: FeedCursor | TrendingCursor | null
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
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('trending')
  const [mixedFeed, setMixedFeed] = useState<MixedTabState>(emptyMixedTab())
  const [tabs, setTabs] = useState<Record<'trending' | 'latest', MixTabState>>({
    trending: emptyMixTab(),
    latest: emptyMixTab(),
  })
  const loadingMoreRef = useRef(false)
  const initializedRef = useRef(false)
  const [newCount, setNewCount] = useState(0)

  const fetchMixTab = useCallback(async (t: 'trending' | 'latest', cursor?: FeedCursor | TrendingCursor) => {
    if (t === 'trending') return getTrending(20, cursor as TrendingCursor | undefined)
    return getRecentMixes(20, cursor as FeedCursor | undefined)
  }, [])

  const fetchFollowingFeed = useCallback(async (mixCursor?: FeedCursor, buzzCursor?: FeedCursor): Promise<MixedFeedResult> => {
    if (!user) return { data: [], mixCursor: null, buzzCursor: null }
    return getMixedFollowingFeed(user.id, 20, mixCursor, buzzCursor)
  }, [user])

  // Initial load for all tabs
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true;

    (['trending', 'latest'] as const).forEach(async t => {
      try {
        const res = await fetchMixTab(t)
        if (res) {
          setTabs(prev => ({ ...prev, [t]: { data: res.data, cursor: res.cursor, hasMore: !!res.cursor, loading: false } }))
        }
      } catch {
        setTabs(prev => ({ ...prev, [t]: { ...emptyMixTab(), loading: false } }))
      }
    })

    if (user) {
      fetchFollowingFeed().then(res => {
        setMixedFeed({ data: res.data, mixCursor: res.mixCursor, buzzCursor: res.buzzCursor, hasMore: !!(res.mixCursor || res.buzzCursor), loading: false })
      }).catch(() => {
        setMixedFeed({ ...emptyMixedTab(), loading: false })
      })
    } else {
      setMixedFeed({ ...emptyMixedTab(), loading: false })
    }
  }, [user, fetchMixTab, fetchFollowingFeed])

  // Tab switch — load if stale
  useEffect(() => {
    if (!initializedRef.current) return
    if (tab === 'feed') {
      if (mixedFeed.data.length > 0 || !mixedFeed.hasMore) return
      if (!user) return
      setMixedFeed(prev => ({ ...prev, loading: true }))
      fetchFollowingFeed().then(res => {
        setMixedFeed({ data: res.data, mixCursor: res.mixCursor, buzzCursor: res.buzzCursor, hasMore: !!(res.mixCursor || res.buzzCursor), loading: false })
      }).catch(() => {
        setMixedFeed(prev => ({ ...prev, loading: false }))
      })
      return
    }
    const state = tabs[tab as 'trending' | 'latest']
    if (state.data.length > 0 || !state.hasMore) return
    setTabs(prev => ({ ...prev, [tab]: { ...prev[tab as 'trending' | 'latest'], loading: true } }))

    fetchMixTab(tab as 'trending' | 'latest').then(res => {
      if (res) {
        setTabs(prev => ({ ...prev, [tab]: { data: res.data, cursor: res.cursor, hasMore: !!res.cursor, loading: false } }))
      }
    }).catch(() => {
      setTabs(prev => ({ ...prev, [tab as 'trending' | 'latest']: { ...prev[tab as 'trending' | 'latest'], loading: false } }))
    })
  }, [tab, user, fetchMixTab, fetchFollowingFeed, tabs, mixedFeed])

  // Realtime: count feed events landing for this user. When the user
  // clicks the "show N new mixes" pill, we re-fetch the following tab.
  useEffect(() => {
    if (!isSupabaseConfigured || !user) return
    const channel = supabase
      .channel(`feed:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'feed_events', filter: `target_id=eq.${user.id}` },
        () => setNewCount(c => c + 1),
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

    const mt = tab as 'trending' | 'latest'
    const state = tabs[mt]
    if (!state.cursor) { loadingMoreRef.current = false; return }
    setTabs(prev => ({ ...prev, [mt]: { ...prev[mt], loading: true } }))
    try {
      const res = await fetchMixTab(mt, state.cursor ?? undefined)
      if (res) {
        setTabs(prev => ({
          ...prev,
          [mt]: { data: [...prev[mt].data, ...res.data], cursor: res.cursor, hasMore: !!res.cursor, loading: false },
        }))
      }
    } catch {
      setTabs(prev => ({ ...prev, [mt]: { ...prev[mt], loading: false } }))
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
    const mt = t as 'trending' | 'latest'
    setTabs(prev => ({ ...prev, [mt]: { ...prev[mt], loading: true } }))
    try {
      const res = await fetchMixTab(mt)
      if (res) setTabs(prev => ({ ...prev, [mt]: { data: res.data, cursor: res.cursor, hasMore: !!res.cursor, loading: false } }))
    } catch {
      setTabs(prev => ({ ...prev, [mt]: { ...prev[mt], loading: false } }))
    }
  }

  function handleBuzzCreated(buzz: Buzz) {
    const feedBuzz = { ...buzz, author: undefined }
    setMixedFeed(prev => ({ ...prev, data: [{ type: 'buzz' as const, data: feedBuzz }, ...prev.data] }))
    if (tab !== 'feed') setNewCount(c => c + 1)
  }

  const currentMixTab = tab !== 'feed' ? tabs[tab as 'trending' | 'latest'] : null
  const currentData: FeedItem[] = tab === 'feed'
    ? mixedFeed.data
    : (currentMixTab?.data ?? []).map(m => ({ type: 'mix' as const, data: m }))
  const currentLoading = tab === 'feed' ? mixedFeed.loading : (currentMixTab?.loading ?? false)
  const currentHasMore = tab === 'feed' ? mixedFeed.hasMore : (currentMixTab?.hasMore ?? false)

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
