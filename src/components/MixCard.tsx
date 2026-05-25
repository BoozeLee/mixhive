import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePlayer } from '../lib/playerStore'
import { repost, unrepost, hasReposted } from '../lib/api'
import { LikeButton } from './LikeButton'
import { ShareButton } from './ShareButton'
import type { FeedMix } from '../lib/types'
import { colors } from '../styles/tokens'

interface Props {
  mix: FeedMix
}

export function MixCard({ mix }: Props) {
  const { user } = useAuth()
  const { play, addToQueue, currentTrack } = usePlayer()
  const [reposted, setReposted] = useState(false)
  const [repostBusy, setRepostBusy] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const isNowPlaying = currentTrack?.id === mix.id

  useEffect(() => {
    if (!user) return
    let cancelled = false
    hasReposted(user.id, mix.id).then(r => {
      if (!cancelled) setReposted(r)
    })
    return () => { cancelled = true }
  }, [user, mix.id])

  async function handleRepost(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!user || repostBusy) return
    setRepostBusy(true)
    const prev = reposted
    setReposted(!prev)
    try {
      if (prev) {
        await unrepost(mix.id)
      } else {
        await repost(user.id, mix.id, mix.dj_id)
      }
    } catch {
      setReposted(prev)
    } finally {
      setRepostBusy(false)
    }
  }

  function handlePlay(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    play({
      id: mix.id,
      title: mix.title,
      djName: mix.dj_display_name || mix.dj_username,
      djUsername: mix.dj_username,
      artworkUrl: mix.artwork_url,
      audioUrl: mix.audio_url,
    }, { clearQueue: true })
  }

  function handlePlayNext(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    addToQueue({
      id: mix.id,
      title: mix.title,
      djName: mix.dj_display_name || mix.dj_username,
      djUsername: mix.dj_username,
      artworkUrl: mix.artwork_url,
      audioUrl: mix.audio_url,
    })
    setShowMenu(false)
  }

  function handleAddToQueue(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    addToQueue({
      id: mix.id,
      title: mix.title,
      djName: mix.dj_display_name || mix.dj_username,
      djUsername: mix.dj_username,
      artworkUrl: mix.artwork_url,
      audioUrl: mix.audio_url,
    })
    setShowMenu(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      {mix.is_repost && mix.reposted_by_username && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 14px 6px',
          fontSize: 11,
          color: '#888',
        }}>
          <span style={{ color: '#6c6', fontSize: 12, lineHeight: 1 }}>🔁</span>
          <span>
            Reposted by{' '}
            <Link
              to={`/u/${mix.reposted_by_username}`}
              onClick={e => e.stopPropagation()}
              style={{ color: '#aaa', textDecoration: 'none', fontWeight: 600 }}
            >
              @{mix.reposted_by_username}
            </Link>
          </span>
        </div>
      )}
      <Link to={`/mix/${mix.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{
        display: 'flex',
        gap: 14,
        padding: 14,
        background: '#111',
        borderRadius: 10,
        border: isNowPlaying ? '1px solid #f0c04044' : '1px solid #1a1a2e',
        transition: 'border-color 0.2s',
        cursor: 'pointer',
      }}
        onMouseEnter={e => e.currentTarget.style.borderColor = '#f0c04044'}
        onMouseLeave={e => {
          if (!isNowPlaying) e.currentTarget.style.borderColor = '#1a1a2e'
        }}
      >
        <div style={{
          width: 70,
          height: 70,
          borderRadius: 8,
          background: 'linear-gradient(135deg, #1a1a2e, #f0c04022)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          color: '#f0c04044',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {mix.artwork_url ? (
            <img
              src={mix.artwork_url}
              alt={`Artwork for ${mix.title}`}
              width={70}
              height={70}
              loading="lazy"
              decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span aria-hidden="true">♪</span>
          )}
          <button
            onClick={handlePlay}
            aria-label={isNowPlaying ? `Restart ${mix.title}` : `Play ${mix.title}`}
            style={{
              position: 'absolute', inset: 0, borderRadius: 8,
              background: 'rgba(0,0,0,0.4)', border: 'none',
              color: '#f0c040', fontSize: 22, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0, transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0'}
          >
            <span aria-hidden="true">▶</span>
          </button>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {isNowPlaying && (
              <span style={{ color: '#f0c040', fontSize: 12, fontWeight: 700, lineHeight: 1 }}>▶</span>
            )}
            <div style={{
              fontSize: 15, fontWeight: 600, color: isNowPlaying ? '#f0c040' : '#eee',
              marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {mix.title}
            </div>
          </div>
          <div style={{ fontSize: 13, color: '#999', marginBottom: 6 }}>
            {mix.dj_display_name || mix.dj_username}
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#666' }}>
            {mix.genre_name && <span>{mix.genre_name}</span>}
            <span>{mix.play_count} plays</span>
            <span>{mix.like_count} likes</span>
            {mix.duration_seconds && (
              <span>{Math.floor(mix.duration_seconds / 60)}:{(mix.duration_seconds % 60).toString().padStart(2, '0')}</span>
            )}
            <span style={{
              background: '#1a1a2e',
              color: '#777',
              fontSize: 10,
              padding: '1px 5px',
              borderRadius: 4,
              fontWeight: 600,
            }}>
              {mix.audio_quality === 'original' ? 'HQ' : (mix.audio_quality || 'MP3')}
            </span>
          </div>
        </div>
        {user && (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, paddingLeft: 4, position: 'relative' }}>
            <LikeButton
              mix={mix}
              userId={user.id}
              variant="icon"
              showCount={true}
            />
            <button
              onClick={handleRepost}
              disabled={repostBusy}
              style={{
                background: 'transparent',
                border: 'none',
                color: reposted ? '#6c6' : '#555',
                cursor: repostBusy ? 'wait' : 'pointer',
                fontSize: 16,
                padding: '4px',
                lineHeight: 1,
                opacity: repostBusy ? 0.6 : 1,
              }}
              title={reposted ? 'Un-repost' : 'Repost'}
            >
              {reposted ? '🔁' : '↻'}
            </button>
            <ShareButton
              mix={mix}
              variant="icon"
              onShare={() => {
                // Handle share if needed
              }}
            />
            <button onClick={e => { e.preventDefault(); e.stopPropagation(); setShowMenu(s => !s) }} style={{
              background: 'transparent', border: 'none', color: showMenu ? '#f0c040' : '#555',
              cursor: 'pointer', fontSize: 16, padding: '4px', lineHeight: 1,
            }} title="Queue">
              ⋯
            </button>
            {showMenu && (
              <div
                role="menu"
                style={{
                position: 'absolute', right: 0, top: '100%', zIndex: 10,
                background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 6,
                minWidth: 120, padding: 4,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
              }}>
                <button role="menuitem" onClick={handlePlayNext} style={{
                  display: 'block', width: '100%', background: 'transparent', border: 'none',
                  color: colors.text.primary, padding: '6px 10px', fontSize: 12, cursor: 'pointer', textAlign: 'left',
                }}>
                  Play Next
                </button>
                <button role="menuitem" onClick={handleAddToQueue} style={{
                  display: 'block', width: '100%', background: 'transparent', border: 'none',
                  color: colors.text.primary, padding: '6px 10px', fontSize: 12, cursor: 'pointer', textAlign: 'left',
                }}>
                  Add to Queue
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
    </div>
  )
}
