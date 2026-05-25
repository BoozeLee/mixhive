import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { createMix } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { AUDIO_BUCKET, ARTWORK_BUCKET, WAVEFORM_BUCKET } from '../lib/api'
import { generateWaveform, waveformToJson } from '../lib/waveform'
import type { Mix, TrackItem } from '../lib/types'

export function Upload() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [genreId, setGenreId] = useState<number | ''>('')
  const [tags, setTags] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [artworkFile, setArtworkFile] = useState<File | null>(null)
  const [tracklist, setTracklist] = useState<TrackItem[]>([])
  const [duration, setDuration] = useState<number | null>(null)
  const [isExplicit, setIsExplicit] = useState(false)
  const [platformLinks, setPlatformLinks] = useState<Record<string, string>>({})
  const [platformErrors, setPlatformErrors] = useState<Record<string, string>>({})
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [detectingDuration, setDetectingDuration] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('genres').select('id, name').order('name').then(({ data }) => {
      if (data) setGenres(data)
    })
  }, [])

  useEffect(() => {
    if (!audioFile || !audioFile.type.startsWith('audio/')) {
      setError('Please select an audio file')
      if (audioFile) setAudioFile(null)
      return
    }

    setDetectingDuration(true)
    setError('')
    const url = URL.createObjectURL(audioFile)
    let timeoutId: ReturnType<typeof setTimeout>
    let cancelled = false

    function cleanup() {
      cancelled = true
      clearTimeout(timeoutId)
      URL.revokeObjectURL(url)
      setDetectingDuration(false)
    }

    try {
      const audio = new Audio(url)
      audio.preload = 'metadata'

      timeoutId = setTimeout(() => {
        setError('Audio duration detection timed out')
        setAudioFile(null)
        cleanup()
      }, 15000)

      audio.addEventListener('canplaythrough', () => {
        if (cancelled) return
        setDuration(Math.round(audio.duration))
        cleanup()
      })

      audio.addEventListener('error', () => {
        if (cancelled) return
        setDuration(null)
        cleanup()
      })
    } catch {
      setError('Failed to process audio file')
      cleanup()
    }

    return cleanup
  }, [audioFile])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !audioFile) return
    setUploading(true)
    setError('')

    // Validate platform links before submitting
    const linkErrors: Record<string, string> = {}
    for (const [key, value] of Object.entries(platformLinks)) {
      if (value && !/^https?:\/\//i.test(value)) {
        linkErrors[key] = 'Must start with http:// or https://'
      }
    }
    if (Object.keys(linkErrors).length > 0) {
      setPlatformErrors(prev => ({ ...prev, ...linkErrors }))
      setUploading(false)
      setError('Please fix invalid platform URLs before uploading')
      return
    }

    try {
      // Generate waveform data (non-critical, can fail silently)
      let waveformUrl = ''
      try {
        const waveform = await generateWaveform(audioFile)
        const jsonStr = waveformToJson(waveform)
        const blob = new Blob([jsonStr], { type: 'application/json' })
        const waveformPath = `${crypto.randomUUID()}.json`
        const { error: wfErr } = await supabase.storage
          .from(WAVEFORM_BUCKET)
          .upload(waveformPath, blob, { contentType: 'application/json' })
        if (!wfErr) {
          const { data: { publicUrl } } = supabase.storage
            .from(WAVEFORM_BUCKET)
            .getPublicUrl(waveformPath)
          waveformUrl = publicUrl
        }
      } catch {
        // Waveform generation is non-critical — upload proceeds without it
      }

      // Upload audio to public bucket for playback
      const audioUrl = await uploadFile(audioFile, AUDIO_BUCKET)
      if (!audioUrl) throw new Error('Failed to upload audio')

      let artworkUrl = ''
      if (artworkFile) {
        artworkUrl = (await uploadFile(artworkFile, ARTWORK_BUCKET)) || ''
      }

      const mixData: Partial<Mix> = {
        dj_id: user.id,
        title,
        description: description || null,
        genre_id: genreId || null,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        duration_seconds: duration,
        is_explicit: isExplicit,
        audio_url: audioUrl,
        artwork_url: artworkUrl || null,
        waveform_url: waveformUrl || null,
        status: 'ready',
        published: true,
      }

      if (tracklist.length > 0) {
        mixData.tracklist = tracklist
      }

      if (Object.keys(platformLinks).length > 0) {
        mixData.platform_links = platformLinks
      }

      const mix = await createMix(mixData)

      if (mix) navigate(`/mix/${mix.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function uploadFile(file: File, bucket: string): Promise<string | null> {
    const ext = file.name.split('.').pop()
    const path = `${crypto.randomUUID()}.${ext}`
    const { error: uploadErr } = await supabase.storage.from(bucket).upload(path, file)
    if (uploadErr) throw uploadErr
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path)
    return publicUrl
  }

  return (
    <div style={{ maxWidth: 540, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eee', marginBottom: 24 }}>Upload a mix</h1>

      {error && (
        <div style={{ background: '#2a1010', color: '#f55', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ color: '#888', fontSize: 13, display: 'block', marginBottom: 4 }}>Audio file *</label>
          <input type="file" accept="audio/*" required
            onChange={e => setAudioFile(e.target.files?.[0] || null)}
            style={{ color: '#ccc', fontSize: 13, width: '100%' }}
          />
        </div>

        <div>
          <label style={{ color: '#888', fontSize: 13, display: 'block', marginBottom: 4 }}>Title *</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
            style={{ width: '100%', background: '#111', border: '1px solid #222', color: '#eee', padding: '10px 14px', borderRadius: 8, fontSize: 14 }}
          />
        </div>

        <div>
          <label style={{ color: '#888', fontSize: 13, display: 'block', marginBottom: 4 }}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
            style={{ width: '100%', background: '#111', border: '1px solid #222', color: '#eee', padding: '10px 14px', borderRadius: 8, fontSize: 14, resize: 'vertical' }}
          />
        </div>

        <div>
          <label style={{ color: '#888', fontSize: 13, display: 'block', marginBottom: 4 }}>Genre</label>
          <select
            value={genreId === '' ? '' : String(genreId)}
            onChange={e => setGenreId(e.target.value === '' ? '' : Number(e.target.value))}
            style={{ width: '100%', background: '#111', border: '1px solid #222', color: '#eee', padding: '10px 14px', borderRadius: 8, fontSize: 14 }}
          >
            <option value="">Select genre</option>
            {genres.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ color: '#888', fontSize: 13, display: 'block', marginBottom: 4 }}>Tags (comma separated)</label>
          <input type="text" value={tags} onChange={e => setTags(e.target.value)}
            placeholder="house, deep, vinyl"
            style={{ width: '100%', background: '#111', border: '1px solid #222', color: '#eee', padding: '10px 14px', borderRadius: 8, fontSize: 14 }}
          />
        </div>

        <div>
          <label style={{ color: '#888', fontSize: 13, display: 'block', marginBottom: 4 }}>Artwork (optional)</label>
          <input type="file" accept="image/*"
            onChange={e => setArtworkFile(e.target.files?.[0] || null)}
            style={{ color: '#ccc', fontSize: 13, width: '100%' }}
          />
        </div>

        <div>
          <label style={{ color: '#888', fontSize: 13, display: 'block', marginBottom: 4 }}>Duration (seconds)</label>
          <input
            type="number"
            value={duration ?? ''}
            onChange={e => setDuration(e.target.value === '' ? null : Number(e.target.value))}
            placeholder="Auto-detected (will show when loaded)"
            style={{ width: '100%', background: '#111', border: '1px solid #222', color: '#eee', padding: '10px 14px', borderRadius: 8, fontSize: 14 }}
          />
          {detectingDuration && (
            <div style={{
              width: '100%',
              height: 4,
              background: '#f0c040',
              borderRadius: 2,
              marginTop: 8,
              animation: 'pulse 2s infinite',
            }} />
          )}
          {duration !== null && !detectingDuration && (
            <small style={{ color: '#6c6', fontSize: 12, display: 'block', marginTop: 4 }}>
              Auto-detected: {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}
            </small>
          )}
        </div>

        <div>
          <label style={{ color: '#888', fontSize: 13, display: 'block', marginBottom: 4 }}>Explicit Content</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isExplicit}
              onChange={(e) => {
  if (!audioFile) {
    setError('Must select audio file to set explicit content')
    return
  }
  setIsExplicit(e.target.checked)
}}

              style={{ width: 16, height: 16 }}
            />
            <span style={{ fontSize: 13, color: '#ccc' }}>Mark as explicit</span>
          </label>
        </div>

        <div>
          <label style={{ color: '#888', fontSize: 13, display: 'block', marginBottom: 4 }}>Platform Links (optional)</label>
          <div style={{ marginTop: 8 }}>
            {[
              ['SoundCloud', 'soundcloud'],
              ['Mixcloud', 'mixcloud'],
              ['YouTube', 'youtube'],
              ['Spotify', 'spotify'],
              ['Apple Music', 'applemusic'],
            ].map(([label, key]) => (
              <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input
                  type="text"
                  value={platformLinks[key] || ''}
                  onChange={e => {
                    const value = e.target.value.trim()
                    const links = { ...platformLinks }
                    const errors = { ...platformErrors }
                    if (value === '') {
                      delete links[key]
                      delete errors[key]
                    } else if (!/^https?:\/\//i.test(value)) {
                      links[key] = value
                      errors[key] = 'Must start with http:// or https://'
                    } else {
                      links[key] = value
                      delete errors[key]
                    }
                    setPlatformLinks(links)
                    setPlatformErrors(errors)
                  }}
                  placeholder={`${label} URL`}
                  style={{
                    flex: 1,
                    background: '#111',
                    border: platformErrors[key] ? '1px solid #f55' : '1px solid #222',
                    color: '#eee',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 13
                  }}
                />
                {platformErrors[key] && (
                  <small style={{ color: '#f55', fontSize: 11, display: 'block', marginTop: 2 }}>
                    {platformErrors[key]}
                  </small>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label style={{ color: '#888', fontSize: 13, display: 'block', marginBottom: 4 }}>Tracklist</label>
          <div style={{ marginTop: 8 }}>
            {tracklist.map((track, index) => (
              <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input
                  type="text"
                  value={track.artist}
                  onChange={e => {
                    const list = [...tracklist]
                    list[index] = { ...list[index], artist: e.target.value }
                    setTracklist(list)
                  }}
                  placeholder="Artist"
                  style={{ flex: 1, background: '#111', border: '1px solid #222', color: '#eee', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}
                />
                <input
                  type="text"
                  value={track.title}
                  onChange={e => {
                    const list = [...tracklist]
                    list[index] = { ...list[index], title: e.target.value }
                    setTracklist(list)
                  }}
                  placeholder="Track Title"
                  style={{ flex: 1, background: '#111', border: '1px solid #222', color: '#eee', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}
                />
                <input
                  type="number"
                  value={track.start_time ?? 0}
                  onChange={e => {
                    const list = [...tracklist]
                    const val = e.target.value === '' ? undefined : Number(e.target.value)
                    list[index] = { ...list[index], start_time: val }
                    setTracklist(list)
                  }}
                  placeholder="Start (sec)"
                  style={{ width: 80, background: '#111', border: '1px solid #222', color: '#eee', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const list = [...tracklist]
                    list.splice(index, 1)
                    setTracklist(list)
                  }}
                  style={{ background: '#2a1010', color: '#f55', border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}
                >
                  −
                </button>
              </div>
            ))}
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setTracklist([...tracklist, { artist: '', title: '' }])}
                style={{ background: '#1a1a2e', color: '#f0c040', border: '1px solid #f0c040', borderRadius: 4, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}
              >
                + Add Track
              </button>
            </div>
          </div>
        </div>

        <button type="submit" disabled={uploading || !audioFile} style={{
          marginTop: 8,
          background: uploading ? '#333' : '#f0c040',
          color: uploading ? '#666' : '#0a0a0a',
          border: 'none',
          padding: '12px',
          borderRadius: 8,
          fontSize: 16,
          fontWeight: 700,
          cursor: uploading ? 'not-allowed' : 'pointer'
        }}>
          {uploading ? 'Uploading...' : 'Publish mix'}
        </button>
      </form>
    </div>
  )
}
