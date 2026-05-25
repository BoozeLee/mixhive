import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getFeed, getTrending, getRecentMixes } from '../lib/api'
import { MixCard } from '../components/MixCard'
import { RecommendedDJs } from '../components/RecommendedDJs'
import { SkeletonFeed } from '../components/Skeleton'
import type { FeedMix, FeedCursor, TrendingCursor } from '../lib/types'

type Tab = 'feed' | 'trending' | 'latest'

interface TabState {
  data: FeedMix[]
  cursor: FeedCursor | TrendingCursor | null
  hasMore: boolean
  loading: boolean
}

const emptyTab = (): TabState => ({ data: [], cursor: null, hasMore: true, loading: true })

export function Feed() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('trending')
  const [tabs, setTabs] = useState<Record<Tab, TabState>>({
    feed: emptyTab(),
    trending: emptyTab(),
    latest: emptyTab(),
  })
  const loadingMoreRef = useRef(false)
  const initializedRef = useRef(false)

  const fetchTab = useCallback(async (t: Tab, cursor?: FeedCursor | TrendingCursor) => {
    if (t === 'feed' && !user) return
    if (t === 'feed') {
      const res = await getFeed(user!.id, 20, cursor as FeedCursor | undefined)
      return res
    }
    if (t === 'trending') {
      const res = await getTrending(20, cursor as TrendingCursor | undefined)
      return res
    }
    const res = await getRecentMixes(20, cursor as FeedCursor | undefined)
    return res
  }, [user])

  // Initial load for all tabs
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true;

    (['trending', 'latest', 'feed'] as Tab[]).forEach(async t => {
      if (t === 'feed' && !user) {
        setTabs(prev => ({ ...prev, feed: { ...emptyTab(), loading: false } }))
        return
      }
      try {
        const res = await fetchTab(t)
        if (res) {
          setTabs(prev => ({ ...prev, [t]: { data: res.data, cursor: res.cursor, hasMore: !!res.cursor, loading: false } }))
        }
      } catch {
        setTabs(prev => ({ ...prev, [t]: { ...emptyTab(), loading: false } }))
      }
    })
  }, [user, fetchTab])

  // Tab switch — load if stale
  useEffect(() => {
    if (!initializedRef.current) return
    const state = tabs[tab]
    if (state.data.length > 0 || !state.hasMore) return
    setTabs(prev => ({ ...prev, [tab]: { ...prev[tab], loading: true } }))

    fetchTab(tab).then(res => {
      if (res) {
        setTabs(prev => ({ ...prev, [tab]: { data: res.data, cursor: res.cursor, hasMore: !!res.cursor, loading: false } }))
      }
    }).catch(() => {
      setTabs(prev => ({ ...prev, [tab]: { ...prev[tab], loading: false } }))
    })
  }, [tab, user, fetchTab, tabs])

  const handleLoadMore = async () => {
    const state = tabs[tab]
    if (!state.cursor || loadingMoreRef.current) return
    loadingMoreRef.current = true
    setTabs(prev => ({ ...prev, [tab]: { ...prev[tab], loading: true } }))

    try {
      const res = await fetchTab(tab, state.cursor)
      if (res) {
        setTabs(prev => ({
          ...prev,
          [tab]: {
            data: [...prev[tab].data, ...res.data],
            cursor: res.cursor,
            hasMore: !!res.cursor,
            loading: false,
          }
        }))
      }
    } catch {
      setTabs(prev => ({ ...prev, [tab]: { ...prev[tab], loading: false } }))
    } finally {
      loadingMoreRef.current = false
    }
  }

  const current = tabs[tab]

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
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

      {user && <RecommendedDJs userId={user.id} />}

      {tab === 'feed' && !user && (
        <div style={{ textAlign: 'center', padding: 40, color: '#666', fontSize: 14 }}>
          Sign in to see your feed
        </div>
      )}

      {current.loading && current.data.length === 0 ? (
        <SkeletonFeed />
      ) : current.data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#666', fontSize: 14 }}>
          {tab === 'feed' ? 'Follow some DJs to see their mixes here' : 'No mixes yet'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {current.data.map(mix => <MixCard key={mix.id} mix={mix} />)}
          {current.hasMore && (
            <button onClick={handleLoadMore} disabled={current.loading}
              style={{
                marginTop: 12,
                padding: '10px 20px',
                background: current.loading ? '#222' : '#111',
                border: '1px solid #333',
                color: '#888',
                borderRadius: 8,
                cursor: current.loading ? 'default' : 'pointer',
                fontSize: 14,
              }}
            >
              {current.loading ? 'Loading...' : 'Load More'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
