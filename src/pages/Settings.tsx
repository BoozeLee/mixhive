import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { ProfileSchema, formatZodError } from '../lib/schemas'

const GENRE_OPTIONS = [
  'House', 'Techno', 'Deep House', 'Tech House', 'Progressive House',
  'Trance', 'Drum & Bass', 'Dubstep', 'UK Garage', 'Breaks',
  'Ambient', 'Downtempo', 'Minimal', 'Electro', 'Disco',
  'Funk / Soul', 'Hip Hop', 'Jazz', 'World', 'Open Format'
]

export function Settings() {
  const { profile, updateProfile } = useAuth()
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    display_name: profile?.display_name || '',
    bio: profile?.bio || '',
    location: profile?.location || '',
    genres: profile?.genres || [] as string[],
  })
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleGenre(g: string) {
    setFormData(prev => ({
      ...prev,
      genres: prev.genres.includes(g) 
        ? prev.genres.filter(x => x !== g) 
        : [...prev.genres, g]
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // Validate with Zod
    const result = ProfileSchema.safeParse(formData)
    if (!result.success) {
      setFormErrors(formatZodError(result.error))
      setError('')
      return
    }
    
    setFormErrors({})
    setError('')
    setSaving(true)
    
    try {
      await updateProfile({
        display_name: result.data.display_name || null,
        bio: result.data.bio || null,
        location: result.data.location || null,
        genres: result.data.genres
      })
      if (profile) navigate(`/u/${profile.username}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container" style={{ maxWidth: 540, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eee', marginBottom: 24 }}>Edit profile</h1>

      {error && (
        <div style={{ background: '#2a1010', color: '#f55', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ color: '#888', fontSize: 13, display: 'block', marginBottom: 4 }}>Display name</label>
          <Input 
            value={formData.display_name} 
            onChange={e => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
            error={formErrors.display_name}
            placeholder="Enter display name"
          />
        </div>

        <div>
          <label style={{ color: '#888', fontSize: 13, display: 'block', marginBottom: 4 }}>Bio</label>
          <Textarea 
            value={formData.bio} 
            onChange={e => setFormData(prev => ({ ...prev, bio: e.target.value }))}
            rows={3}
            placeholder="Tell us about yourself..."
          />
        </div>

        <div>
          <label style={{ color: '#888', fontSize: 13, display: 'block', marginBottom: 4 }}>Location</label>
          <Input 
            value={formData.location} 
            onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
            placeholder="City, Country"
          />
        </div>

        <div>
          <label style={{ color: '#888', fontSize: 13, display: 'block', marginBottom: 8 }}>Genres</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {GENRE_OPTIONS.map(g => (
              <button
                key={g}
                type="button"
                onClick={() => toggleGenre(g)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 16,
                  border: 'none',
                  background: formData.genres.includes(g) ? '#f0c040' : '#1a1a2e',
                  color: formData.genres.includes(g) ? '#0a0a0a' : '#777',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: formData.genres.includes(g) ? 600 : 400
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" disabled={saving} className="w-full" style={{ marginTop: 8 }}>
          {saving ? 'Saving...' : 'Save profile'}
        </Button>
      </form>
    </div>
  )
}
