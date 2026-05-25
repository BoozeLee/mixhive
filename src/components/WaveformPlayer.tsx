import { useRef, useState, useEffect, useCallback } from 'react'

interface Props {
  src: string
  waveformUrl?: string | null
  onPlay?: () => void
}

const BAR_GAP = 1
const SAMPLE_COUNT = 200

export function WaveformPlayer({ src, waveformUrl, onPlay }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [waveform, setWaveform] = useState<number[] | null>(null)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [showVolume, setShowVolume] = useState(false)

  // Load waveform data from public URL
  useEffect(() => {
    if (!waveformUrl) return
    let cancelled = false
    fetch(waveformUrl)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        setWaveform(Array.isArray(data) ? data : [])
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [waveformUrl])

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setCurrentTime(audio.currentTime)
    const onDur = () => { if (audio.duration && isFinite(audio.duration)) setDuration(audio.duration) }
    const onEnd = () => setPlaying(false)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onDur)
    audio.addEventListener('ended', onEnd)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onDur)
      audio.removeEventListener('ended', onEnd)
    }
  }, [])

  // Canvas rendering loop
  useEffect(() => {
    const canvas = canvasRef.current
    const audio = audioRef.current
    if (!canvas || !audio) return

    function draw() {
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      canvas.width = w * devicePixelRatio
      canvas.height = h * devicePixelRatio
      ctx.scale(devicePixelRatio, devicePixelRatio)

      ctx.clearRect(0, 0, w, h)

      const samples = waveform || Array(SAMPLE_COUNT).fill(0.3)
      const barWidth = (w - (samples.length - 1) * BAR_GAP) / samples.length
      const progress = duration > 0 ? currentTime / duration : 0

      for (let i = 0; i < samples.length; i++) {
        const x = i * (barWidth + BAR_GAP)
        const barH = Math.max(2, samples[i] * h * 0.8)
        const y = (h - barH) / 2
        const isPlayed = i / samples.length <= progress

        ctx.fillStyle = isPlayed ? '#f0c040' : '#333'
        ctx.fillRect(x, y, barWidth, barH)
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [waveform, currentTime, duration])

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

  function handleSeek(e: React.MouseEvent<HTMLCanvasElement>) {
    const audio = audioRef.current
    const canvas = canvasRef.current
    if (!audio || !canvas || !duration) return
    const rect = canvas.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audio.currentTime = pct * duration
  }

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

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div style={{
      background: '#0f0f0f',
      border: '1px solid #1a1a2e',
      borderRadius: 10,
      padding: '12px 16px',
    }}>
      <audio ref={audioRef} src={src} preload="metadata" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
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
          <canvas
            ref={canvasRef}
            onClick={handleSeek}
            style={{
              width: '100%',
              height: 48,
              borderRadius: 4,
              cursor: 'pointer',
              display: 'block',
            }}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: '#666',
            marginTop: 4,
          }}>
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
              zIndex: 10,
            }}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                style={{ width: 80, height: 4, accentColor: '#f0c040' }}
                title="Volume"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
