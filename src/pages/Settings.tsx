import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { ProfilePictureUploadSmall } from '../components/ProfilePictureUploadSmall'
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
    social_links: profile?.social_links || {} as Record<string, string>,
  })

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleAvatarUploadComplete = () => {
    // Profile will be automatically updated, just refresh the page
    window.location.reload()
  }

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

      {/* Profile Picture Upload */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#ccc', marginBottom: 16 }}>Profile Picture</h2>
        <ProfilePictureUploadSmall
          profile={profile}
          currentUserId={profile?.id || ''}
          onUploadComplete={handleAvatarUploadComplete}
        />
      </div>

      {error && (
        <div style={{ background: '#2a1010', color: '#f55', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input
          label="Display name"
          value={formData.display_name}
          onChange={e => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
          error={formErrors.display_name}
          placeholder="Enter display name"
        />

        <Textarea
          label="Bio"
          value={formData.bio}
          onChange={e => setFormData(prev => ({ ...prev, bio: e.target.value }))}
          rows={3}
          placeholder="Tell us about yourself..."
        />

        <Input
          label="Location"
          value={formData.location}
          onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
          placeholder="City, Country"
        />

        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ color: '#888', fontSize: 13, marginBottom: 8 }}>Genres</legend>
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
        </fieldset>

        {/* Social Links */}
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ color: '#888', fontSize: 13, marginBottom: 8 }}>Social Links</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
            {['twitter', 'instagram', 'soundcloud', 'youtube', 'spotify', 'website'].map(platform => (
              <div key={platform} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>
                  {getPlatformIcon(platform)}
                </span>
                <Input
                  type="text"
                  value={formData.social_links[platform] || ''}
                  onChange={e => {
                    const value = e.target.value.trim()
                    const links = { ...formData.social_links }
                    if (value) {
                      links[platform] = value
                    } else {
                      delete links[platform]
                    }
                    setFormData(prev => ({ ...prev, social_links: links }))
                  }}
                  placeholder={`${platform.charAt(0).toUpperCase() + platform.slice(1)} URL`}
                  style={{ flex: 1 }}
                />
              </div>
            ))}
          </div>
          <p style={{ color: '#666', fontSize: 11, marginTop: 4 }}>
            Add links to your social media profiles or website
          </p>
        </fieldset>

        <Button type="submit" disabled={saving} className="w-full" style={{ marginTop: 8 }}>
          {saving ? 'Saving...' : 'Save profile'}
        </Button>
      </form>
    </div>
  )
}

function getPlatformIcon(platform: string): string {
  const icons: Record<string, string> = {
    twitter: '🐦',
    instagram: '📷',
    soundcloud: '🎵',
    youtube: '📺',
    spotify: '🎧',
    website: '🌐'
  }
  return icons[platform] || '🔗'
}
