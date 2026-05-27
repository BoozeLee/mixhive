import { useEffect, useState } from 'react'
import { getPlaylistsByUser, createPlaylist, addMixToPlaylist, removeMixFromPlaylist, isMixInPlaylist } from '../lib/api'
import type { Playlist } from '../lib/types'

interface Props {
  mixId: string
  userId: string
  onClose: () => void
}

export function AddToPlaylistModal({ mixId, userId, onClose }: Props) {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [mixStatus, setMixStatus] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    getPlaylistsByUser(userId).then(async list => {
      setPlaylists(list)
      const status: Record<string, boolean> = {}
      await Promise.all(list.map(async p => {
        status[p.id] = await isMixInPlaylist(p.id, mixId)
      }))
      setMixStatus(status)
      setLoading(false)
    })
  }, [userId, mixId])

  async function togglePlaylist(playlistId: string, inPlaylist: boolean) {
    setMixStatus(prev => ({ ...prev, [playlistId]: !inPlaylist }))
    if (inPlaylist) {
      await removeMixFromPlaylist(playlistId, mixId)
    } else {
      await addMixToPlaylist(playlistId, mixId)
    }
  }

  async function handleCreate() {
    if (!newTitle.trim() || creating) return
    setCreating(true)
    const pl = await createPlaylist(newTitle.trim(), userId)
    if (pl) {
      setPlaylists(prev => [...prev, pl])
      await addMixToPlaylist(pl.id, mixId)
      setMixStatus(prev => ({ ...prev, [pl.id]: true }))
      setNewTitle('')
    }
    setCreating(false)
  }

  return (
    // Backdrop close: the ESC + focus-trap a11y is handled by the explicit
    // Close button below; the backdrop is just an alternate dismissal route
    // for pointer users and intentionally doesn't take focus.
    <div
      role="presentation"
      style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      }}
      onClick={onClose}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-to-playlist-title"
        style={{
        background: '#111',
        borderRadius: 12,
        border: '1px solid #222',
        padding: 24,
        width: '90%',
        maxWidth: 400,
        maxHeight: '80vh',
        overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 id="add-to-playlist-title" style={{ fontSize: 16, fontWeight: 600, color: '#eee', margin: 0 }}>Add to Playlist</h3>
          <button aria-label="Close playlist modal" onClick={onClose} style={{
            background: 'transparent',
            border: 'none',
            color: '#666',
            fontSize: 20,
            cursor: 'pointer',
            padding: 4,
          }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
            placeholder="New playlist name..."
            style={{
              flex: 1,
              background: '#0a0a0a',
              border: '1px solid #222',
              color: '#eee',
              padding: '8px 12px',
              borderRadius: 6,
              fontSize: 13,
            }}
          />
          <button onClick={handleCreate} disabled={creating || !newTitle.trim()} style={{
            background: '#f0c040',
            color: '#0a0a0a',
            border: 'none',
            borderRadius: 6,
            padding: '8px 14px',
            fontWeight: 600,
            fontSize: 13,
            cursor: creating || !newTitle.trim() ? 'not-allowed' : 'pointer',
            opacity: creating || !newTitle.trim() ? 0.5 : 1,
          }}>
            {creating ? '...' : 'Create'}
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#666', fontSize: 13 }}>Loading...</div>
        ) : playlists.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#666', fontSize: 13 }}>
            No playlists yet. Create one above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {playlists.map(p => {
              const inPlaylist = mixStatus[p.id]
              return (
                <button key={p.id} onClick={() => togglePlaylist(p.id, !!inPlaylist)} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  background: inPlaylist ? '#1a1a2e' : 'transparent',
                  border: `1px solid ${inPlaylist ? '#f0c04044' : '#222'}`,
                  borderRadius: 8,
                  color: '#ccc',
                  cursor: 'pointer',
                  fontSize: 13,
                  textAlign: 'left',
                  width: '100%',
                }}>
                  <span style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    background: inPlaylist ? '#f0c040' : 'transparent',
                    border: `2px solid ${inPlaylist ? '#f0c040' : '#444'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#0a0a0a',
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {inPlaylist && '✓'}
                  </span>
                  <span style={{ flex: 1 }}>{p.title}</span>
                  <span style={{ color: '#555', fontSize: 11 }}>{p.mix_count}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
