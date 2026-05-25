import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'

const GENRE_OPTIONS = [
  'House', 'Techno', 'Deep House', 'Tech House', 'Progressive House',
  'Trance', 'Drum & Bass', 'Dubstep', 'UK Garage', 'Breaks',
  'Ambient', 'Downtempo', 'Minimal', 'Electro', 'Disco',
  'Funk / Soul', 'Hip Hop', 'Jazz', 'World', 'Open Format'
]

export function Settings() {
  const { profile, updateProfile } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [location, setLocation] = useState(profile?.location || '')
  const [selectedGenres, setSelectedGenres] = useState<string[]>(profile?.genres || [])
  const [saving, setSaving] = useState(false)

  function toggleGenre(g: string) {
    setSelectedGenres(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await updateProfile({
      display_name: displayName || null,
      bio: bio || null,
      location: location || null,
      genres: selectedGenres
    })
    setSaving(false)
    if (profile) navigate(`/u/${profile.username}`)
  }

  return (
    <div style={{ maxWidth: 540, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eee', marginBottom: 24 }}>Edit profile</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ color: '#888', fontSize: 13, display: 'block', marginBottom: 4 }}>Display name</label>
          <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
            style={{ width: '100%', background: '#111', border: '1px solid #222', color: '#eee', padding: '10px 14px', borderRadius: 8, fontSize: 14 }}
          />
        </div>

        <div>
          <label style={{ color: '#888', fontSize: 13, display: 'block', marginBottom: 4 }}>Bio</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
            style={{ width: '100%', background: '#111', border: '1px solid #222', color: '#eee', padding: '10px 14px', borderRadius: 8, fontSize: 14, resize: 'vertical' }}
          />
        </div>

        <div>
          <label style={{ color: '#888', fontSize: 13, display: 'block', marginBottom: 4 }}>Location</label>
          <input type="text" value={location} onChange={e => setLocation(e.target.value)}
            placeholder="City, Country"
            style={{ width: '100%', background: '#111', border: '1px solid #222', color: '#eee', padding: '10px 14px', borderRadius: 8, fontSize: 14 }}
          />
        </div>

        <div>
          <label style={{ color: '#888', fontSize: 13, display: 'block', marginBottom: 8 }}>Genres</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {GENRE_OPTIONS.map(g => (
              <button key={g} type="button" onClick={() => toggleGenre(g)} style={{
                padding: '6px 12px',
                borderRadius: 16,
                border: 'none',
                background: selectedGenres.includes(g) ? '#f0c040' : '#1a1a2e',
                color: selectedGenres.includes(g) ? '#0a0a0a' : '#777',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: selectedGenres.includes(g) ? 600 : 400
              }}>
                {g}
              </button>
            ))}
          </div>
        </div>

        <button type="submit" disabled={saving} style={{
          marginTop: 8,
          background: saving ? '#333' : '#f0c040',
          color: saving ? '#666' : '#0a0a0a',
          border: 'none',
          padding: '12px',
          borderRadius: 8,
          fontSize: 16,
          fontWeight: 700,
          cursor: saving ? 'not-allowed' : 'pointer'
        }}>
          {saving ? 'Saving...' : 'Save profile'}
        </button>
      </form>
    </div>
  )
}
