import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getMix } from '../lib/api'
import type { Mix } from '../lib/types'

export function EmbedMix() {
  const { id } = useParams<{ id: string }>()
  const [mix, setMix] = useState<Mix | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return
    getMix(id).then(setMix).catch(() => setError(true))
  }, [id])

  if (error) {
    return (
      <div
        role="alert"
        style={{
          background: '#0a0a0a',
          color: '#888',
          padding: 20,
          textAlign: 'center',
          fontFamily: 'sans-serif',
          fontSize: 13,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <span style={{ color: '#f0c040', fontSize: 18, marginBottom: 4 }} aria-hidden="true">♪</span>
        This mix is unavailable
      </div>
    )
  }

  if (!mix) {
    return <div style={{ background: '#0a0a0a', color: '#444', padding: 20, textAlign: 'center', fontFamily: 'sans-serif' }}>Loading...</div>
  }

  const audioUrl = mix.audio_url

  return (
    <div style={{
      background: '#0a0a0a',
      color: '#eee',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      height: '100%',
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 8,
        background: mix.artwork_url
          ? `url(${mix.artwork_url}) center/cover`
          : 'linear-gradient(135deg, #1a1a2e, #f0c04022)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        color: '#f0c04044',
      }}>
        {!mix.artwork_url && '♪'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {mix.title}
        </div>
        <div style={{ fontSize: 12, color: '#888' }}>
          {mix.dj?.display_name || mix.dj?.username}
        </div>
      </div>

      <audio controls preload="none" style={{ height: 36, maxWidth: 200 }}>
        <source src={audioUrl} />
      </audio>
    </div>
  )
}
