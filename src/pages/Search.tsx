import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { searchProfiles, searchMixes } from '../lib/api'
import { MixCard } from '../components/MixCard'
import { SkeletonFeed } from '../components/Skeleton'
import type { Profile, FeedMix } from '../lib/types'

export function SearchPage() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const [tab, setTab] = useState<'mixes' | 'djs'>('mixes')
  const [mixes, setMixes] = useState<FeedMix[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query.trim()) return
    setLoading(true)
    const promises = tab === 'mixes'
      ? searchMixes(query).then(setMixes)
      : searchProfiles(query).then(setProfiles)
    promises.finally(() => setLoading(false))
  }, [query, tab])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#eee', marginBottom: 4 }}>
        {query ? <>Results for "<span style={{ color: '#f0c040' }}>{query}</span>"</> : 'Search'}
      </h1>
      {!query && (
        <p style={{ color: '#555', fontSize: 14, marginTop: 12 }}>
          Use the search bar in the navigation to find DJs and mixes.
        </p>
      )}

      {query && (
        <>
          <div style={{ display: 'flex', gap: 4, marginTop: 20, marginBottom: 20, background: '#111', borderRadius: 10, padding: 4 }}>
            {(['mixes', 'djs'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1,
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: tab === t ? '#f0c040' : 'transparent',
                color: tab === t ? '#0a0a0a' : '#666',
                fontWeight: tab === t ? 700 : 400,
                cursor: 'pointer',
                fontSize: 13,
                textTransform: 'capitalize',
              }}>
                {t === 'djs' ? 'DJs' : t}
              </button>
            ))}
          </div>

          {loading ? (
            <SkeletonFeed />
          ) : tab === 'mixes' ? (
            mixes.length === 0 ? (
              <p style={{ color: '#555', fontSize: 14, textAlign: 'center', padding: 40 }}>No mixes found</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {mixes.map(mix => <MixCard key={mix.id} mix={mix} />)}
              </div>
            )
          ) : (
            profiles.length === 0 ? (
              <p style={{ color: '#555', fontSize: 14, textAlign: 'center', padding: 40 }}>No DJs found</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {profiles.map(p => (
                  <Link key={p.id} to={`/u/${p.username}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{
                      display: 'flex',
                      gap: 14,
                      padding: 14,
                      background: '#111',
                      borderRadius: 10,
                      border: '1px solid #1a1a2e',
                      alignItems: 'center',
                    }}>
                      <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: p.avatar_url ? `url(${p.avatar_url}) center/cover` : 'linear-gradient(135deg, #1a1a2e, #f0c04022)',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        color: '#f0c04044',
                      }}>
                        {!p.avatar_url && '🎧'}
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#eee' }}>
                          {p.display_name || p.username}
                          {p.verified && <span style={{ color: '#f0c040', fontSize: 12, marginLeft: 4 }}>✓</span>}
                        </div>
                        <div style={{ fontSize: 13, color: '#666' }}>@{p.username}</div>
                        {p.bio && <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{p.bio}</div>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}
