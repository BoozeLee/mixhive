import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getPlaylistWithMixes, updatePlaylist, deletePlaylist, removeMixFromPlaylist } from '../lib/api'
import { MixCard } from '../components/MixCard'
import { SkeletonFeed } from '../components/Skeleton'
import { NotFoundState } from '../components/EmptyState'
import type { PlaylistWithMixes, FeedMix } from '../lib/types'

export function PlaylistDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [playlist, setPlaylist] = useState<PlaylistWithMixes | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [editingDesc, setEditingDesc] = useState(false)
  const [descDraft, setDescDraft] = useState('')
  const [deleting, setDeleting] = useState(false)

  const isOwner = user && playlist && user.id === playlist.owner_id

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getPlaylistWithMixes(id).then(p => {
      if (!p) {
        setError('Playlist not found')
      } else {
        setPlaylist(p)
        setTitleDraft(p.title)
        setDescDraft(p.description || '')
      }
      setLoading(false)
    }).catch(() => {
      setError('Failed to load playlist')
      setLoading(false)
    })
  }, [id])

  async function saveTitle() {
    if (!playlist || !id || !titleDraft.trim()) return
    await updatePlaylist(id, { title: titleDraft.trim() })
    setPlaylist({ ...playlist, title: titleDraft.trim() })
    setEditingTitle(false)
  }

  async function saveDescription() {
    if (!playlist || !id) return
    await updatePlaylist(id, { description: descDraft || null })
    setPlaylist({ ...playlist, description: descDraft || null })
    setEditingDesc(false)
  }

  async function handleDeletePlaylist() {
    if (!id) return
    if (!window.confirm('Delete this playlist? This cannot be undone.')) return
    setDeleting(true)
    await deletePlaylist(id)
    navigate(-1)
  }

  async function handleRemoveMix(mixId: string) {
    if (!id || !playlist) return
    await removeMixFromPlaylist(id, mixId)
    setPlaylist({
      ...playlist,
      mixes: playlist.mixes.filter(m => m.id !== mixId),
      mix_count: playlist.mix_count - 1,
    })
  }

  if (loading) return <SkeletonFeed />

  if (error || !playlist) {
    return <NotFoundState what="playlist" />
  }

  const mixesAsFeedMix: FeedMix[] = playlist.mixes.map(m => ({
    id: m.id,
    dj_id: m.dj_id,
    title: m.title,
    description: null,
    artwork_url: m.artwork_url,
    audio_url: m.audio_url,
    duration_seconds: m.duration_seconds,
    genre_id: null,
    tags: m.tags,
    tracklist: [],
    platform_links: {},
    is_explicit: false,
    play_count: m.play_count,
    like_count: m.like_count,
    comment_count: 0,
    published: true,
    status: 'ready' as const,
    waveform_url: m.waveform_url,
    audio_quality: m.audio_quality,
    created_at: m.created_at,
    updated_at: m.created_at,
    dj_username: m.dj_username,
    dj_display_name: m.dj_display_name,
    dj_avatar_url: m.dj_avatar_url,
    genre_name: m.genre_name,
    weekly_plays: 0,
    score: 0,
  }))

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        {editingTitle ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(playlist.title) } }}
              autoFocus
              style={{
                flex: 1,
                background: '#0a0a0a',
                border: '1px solid #f0c040',
                color: '#eee',
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: 22,
                fontWeight: 700,
              }}
            />
            <button onClick={saveTitle} style={{ background: '#f0c040', color: '#0a0a0a', border: 'none', borderRadius: 6, padding: '8px 14px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Save</button>
            <button onClick={() => { setEditingTitle(false); setTitleDraft(playlist.title) }} style={{ background: 'transparent', border: '1px solid #333', color: '#888', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          </div>
        ) : (
          <h1
            onClick={() => { if (isOwner) setEditingTitle(true) }}
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#eee',
              margin: '0 0 4px',
              cursor: isOwner ? 'text' : 'default',
            }}
          >
            {playlist.title}
          </h1>
        )}

        {editingDesc ? (
          <div style={{ marginTop: 8 }}>
            <textarea
              value={descDraft}
              onChange={e => setDescDraft(e.target.value)}
              rows={3}
              autoFocus
              style={{
                width: '100%',
                background: '#0a0a0a',
                border: '1px solid #f0c040',
                color: '#eee',
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: 13,
                resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button onClick={saveDescription} style={{ background: '#f0c040', color: '#0a0a0a', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>Save</button>
              <button onClick={() => { setEditingDesc(false); setDescDraft(playlist.description || '') }} style={{ background: 'transparent', border: '1px solid #333', color: '#888', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
            </div>
          </div>
        ) : (
          <p
            onClick={() => { if (isOwner) setEditingDesc(true) }}
            style={{
              color: playlist.description ? '#777' : '#555',
              fontSize: 14,
              marginTop: 8,
              cursor: isOwner ? 'text' : 'default',
              fontStyle: playlist.description ? 'normal' : 'italic',
            }}
          >
            {playlist.description || (isOwner ? 'Add a description...' : '')}
          </p>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 13, color: '#888', alignItems: 'center' }}>
          <Link to={`/u/${playlist.owner_username}`} style={{ color: '#999', textDecoration: 'none' }}>
            {playlist.owner_display_name || playlist.owner_username}
          </Link>
          <span>{playlist.mix_count} {playlist.mix_count === 1 ? 'mix' : 'mixes'}</span>
          {!playlist.is_public && <span style={{ color: '#f0c04066' }}>Private</span>}
        </div>

        {isOwner && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={handleDeletePlaylist} disabled={deleting} style={{
              background: 'transparent',
              border: '1px solid #331111',
              color: '#f55',
              padding: '6px 14px',
              borderRadius: 6,
              cursor: deleting ? 'not-allowed' : 'pointer',
              fontSize: 12,
              opacity: deleting ? 0.5 : 1,
            }}>
              {deleting ? 'Deleting...' : 'Delete Playlist'}
            </button>
          </div>
        )}
      </div>

      {playlist.mixes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#666', fontSize: 14 }}>
          No mixes in this playlist yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mixesAsFeedMix.map(mix => (
            <div key={mix.id} style={{ position: 'relative' }}>
              <MixCard mix={mix} />
              {isOwner && (
                <button onClick={() => handleRemoveMix(mix.id)} style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: '#2a1010',
                  border: 'none',
                  color: '#f55',
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontSize: 12,
                  cursor: 'pointer',
                  zIndex: 2,
                }}>
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
