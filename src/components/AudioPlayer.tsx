import { useRef, useState, useEffect, useCallback } from 'react'

interface Props {
  src: string
  onPlay?: () => void
}

export function AudioPlayer({ src, onPlay }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [showVolume, setShowVolume] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => setDuration(audio.duration)
    const ended = () => setPlaying(false)
    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('ended', ended)
    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('ended', ended)
    }
  }, [])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
    } else {
      audio.play()
      onPlay?.()
    }
    setPlaying(!playing)
  }, [playing, onPlay])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return
      if (e.code === 'Space') {
        e.preventDefault()
        toggle()
      }
      if (e.code === 'ArrowLeft') {
        e.preventDefault()
        const audio = audioRef.current
        if (audio) audio.currentTime = Math.max(0, audio.currentTime - 10)
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault()
        const audio = audioRef.current
        if (audio) audio.currentTime = Math.min(duration, audio.currentTime + 10)
      }
      if (e.code === 'ArrowUp') {
        e.preventDefault()
        const audio = audioRef.current
        if (audio) {
          const v = Math.min(1, audio.volume + 0.1)
          audio.volume = v
          setVolume(v)
          setMuted(false)
        }
      }
      if (e.code === 'ArrowDown') {
        e.preventDefault()
        const audio = audioRef.current
        if (audio) {
          const v = Math.max(0, audio.volume - 0.1)
          audio.volume = v
          setVolume(v)
          setMuted(v === 0)
        }
      }
      if (e.code === 'KeyM') {
        e.preventDefault()
        toggleMute()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggle, duration])

  function toggleMute() {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = !audio.muted
    setMuted(audio.muted)
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseFloat(e.target.value)
    const audio = audioRef.current
    if (audio) {
      audio.volume = v
      audio.muted = false
    }
    setVolume(v)
    setMuted(false)
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    audio.currentTime = pct * duration
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div ref={containerRef} style={{
      background: '#0f0f0f',
      border: '1px solid #1a1a2e',
      borderRadius: 10,
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <audio ref={audioRef} src={src} preload="metadata" />

      <button onClick={toggle} style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: 'none',
        background: '#f0c040',
        color: '#0a0a0a',
        fontSize: 16,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {playing ? '⏸' : '▶'}
      </button>

      <div style={{ flex: 1 }}>
        <div onClick={seek} style={{
          height: 4,
          background: '#222',
          borderRadius: 2,
          cursor: 'pointer',
          position: 'relative',
        }}>
          <div style={{
            height: '100%',
            width: duration ? `${(currentTime / duration) * 100}%` : '0%',
            background: '#f0c040',
            borderRadius: 2,
            transition: 'width 0.1s linear',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#666', marginTop: 4 }}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
        onMouseEnter={() => setShowVolume(true)}
        onMouseLeave={() => setShowVolume(false)}
      >
        <button onClick={toggleMute} style={{
          background: 'transparent',
          border: 'none',
          color: muted ? '#f55' : '#666',
          cursor: 'pointer',
          fontSize: 16,
          padding: 4,
          lineHeight: 1,
        }} title={muted ? 'Unmute' : 'Mute'}>
          {muted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
        </button>
        {showVolume && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 8,
            background: '#1a1a2e',
            border: '1px solid #333',
            borderRadius: 8,
            padding: '8px 4px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            zIndex: 10,
          }}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
              style={{ width: 80, height: 4, accentColor: '#f0c040', writingMode: 'vertical-lr', direction: 'rtl' }}
              title="Volume"
            />
          </div>
        )}
      </div>
    </div>
  )
}
