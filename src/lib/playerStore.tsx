import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from 'react'

export interface TrackInfo {
  id: string
  title: string
  djName: string
  djUsername: string
  artworkUrl: string | null
  audioUrl: string
}

interface PlayerContextType {
  currentTrack: TrackInfo | null
  queue: TrackInfo[]
  queueIndex: number
  play: (track: TrackInfo, options?: { clearQueue?: boolean }) => void
  playNext: () => void
  playPrevious: () => void
  addToQueue: (track: TrackInfo) => void
  removeFromQueue: (index: number) => void
  clearQueue: () => void
  stop: () => void
  playing: boolean
  togglePlay: () => void
  currentTime: number
  duration: number
  seek: (time: number) => void
  volume: number
  muted: boolean
  setVolume: (v: number) => void
  toggleMute: () => void
  miniMode: boolean
  toggleMini: () => void
}

const PlayerContext = createContext<PlayerContextType | null>(null)

function getSavedVolume(): number {
  try { return parseFloat(localStorage.getItem('player_volume') || '1') } catch { return 1 }
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<TrackInfo | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [queue, setQueue] = useState<TrackInfo[]>([])
  const [queueIndex, setQueueIndex] = useState(-1)
  const [volume, setVolumeState] = useState(getSavedVolume)
  const [muted, setMuted] = useState(false)
  const [miniMode, setMiniMode] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // --- Audio event listeners ---
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setCurrentTime(audio.currentTime)
    const onDur = () => { if (audio.duration && isFinite(audio.duration)) setDuration(audio.duration) }
    const onEnd = () => {
      // Auto-play next track in queue
      const nextIdx = queueIndex + 1
      if (queue.length > nextIdx) {
        const next = queue[nextIdx]
        setCurrentTrack(next)
        setQueueIndex(nextIdx)
        setCurrentTime(0)
        setDuration(0)
        const newAudio = new Audio(next.audioUrl)
        newAudio.preload = 'metadata'
        newAudio.volume = muted ? 0 : volume
        newAudio.play()
        audioRef.current = newAudio
        setPlaying(true)
      } else {
        setPlaying(false)
      }
    }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onDur)
    audio.addEventListener('ended', onEnd)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onDur)
      audio.removeEventListener('ended', onEnd)
    }
  }, [currentTrack, queue, queueIndex, volume, muted])

  // --- Keyboard shortcuts ---
  useEffect(() => {
    if (!currentTrack) return
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.code === 'Space') {
        e.preventDefault()
        setPlaying(p => {
          if (audioRef.current) {
            if (p) audioRef.current.pause()
            else audioRef.current.play()
          }
          return !p
        })
      }
      if (e.code === 'ArrowLeft') {
        e.preventDefault()
        if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5)
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault()
        if (audioRef.current && duration) audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 5)
      }
      if (e.code === 'ArrowUp') {
        e.preventDefault()
        const v = Math.min(1, volume + 0.05)
        setVolumeState(v)
        localStorage.setItem('player_volume', String(v))
        if (audioRef.current) { audioRef.current.volume = v; audioRef.current.muted = false }
        setMuted(false)
      }
      if (e.code === 'ArrowDown') {
        e.preventDefault()
        const v = Math.max(0, volume - 0.05)
        setVolumeState(v)
        localStorage.setItem('player_volume', String(v))
        if (audioRef.current) { audioRef.current.volume = v; audioRef.current.muted = false }
        setMuted(false)
      }
      if (e.code === 'KeyM') {
        e.preventDefault()
        setMuted(m => {
          if (audioRef.current) audioRef.current.muted = !m
          return !m
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentTrack, duration, volume])

  // --- Actions (ordered to avoid TDZ) ---

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setCurrentTrack(null)
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setQueue([])
    setQueueIndex(-1)
  }, [])

  const loadTrack = useCallback((track: TrackInfo) => {
    const audio = new Audio(track.audioUrl)
    audio.preload = 'metadata'
    audio.volume = muted ? 0 : volume
    audio.play().catch(() => {})
    if (audioRef.current) audioRef.current.pause()
    audioRef.current = audio
    setCurrentTrack(track)
    setPlaying(true)
    setCurrentTime(0)
    setDuration(0)
  }, [volume, muted])

  const playNext = useCallback(() => {
    const nextIdx = queueIndex + 1
    if (queue.length <= nextIdx) return
    loadTrack(queue[nextIdx])
    setQueueIndex(nextIdx)
  }, [queue, queueIndex, loadTrack])

  const playPrevious = useCallback(() => {
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0
      return
    }
    const prevIdx = queueIndex - 1
    if (prevIdx < 0) return
    loadTrack(queue[prevIdx])
    setQueueIndex(prevIdx)
  }, [queue, queueIndex, loadTrack])

  const addToQueue = useCallback((track: TrackInfo) => {
    setQueue(prev => {
      if (prev.some(t => t.id === track.id)) return prev
      return [...prev, track]
    })
    if (queueIndex === -1) setQueueIndex(0)
  }, [queueIndex])

  const removeFromQueue = useCallback((index: number) => {
    setQueue(prev => {
      const next = [...prev]
      next.splice(index, 1)
      return next
    })
    setQueueIndex(prev => {
      if (index < prev) return prev - 1
      if (index === prev) {
        // Currently playing was removed
        const nextIdx = prev + 1
        if (queue.length > nextIdx) {
          loadTrack(queue[nextIdx])
          return nextIdx
        } else {
          stop()
          return -1
        }
      }
      return prev
    })
  }, [queue, loadTrack, stop])

  const clearQueue = useCallback(() => {
    setQueue([])
    setQueueIndex(-1)
  }, [])

  const play = useCallback((track: TrackInfo, options?: { clearQueue?: boolean }) => {
    if (options?.clearQueue) {
      setQueue([])
      setQueueIndex(-1)
    }
    loadTrack(track)
  }, [loadTrack])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setPlaying(p => {
      if (p) audio.pause()
      else audio.play()
      return !p
    })
  }, [])

  const seek = useCallback((time: number) => {
    const audio = audioRef.current
    if (audio) audio.currentTime = time
  }, [])

  const setVolume = useCallback((v: number) => {
    setVolumeState(v)
    localStorage.setItem('player_volume', String(v))
    if (audioRef.current) { audioRef.current.volume = v; audioRef.current.muted = false }
    setMuted(false)
  }, [])

  const toggleMute = useCallback(() => {
    setMuted(m => {
      if (audioRef.current) audioRef.current.muted = !m
      return !m
    })
  }, [])

  const toggleMini = useCallback(() => setMiniMode(m => !m), [])

  return (
    <PlayerContext.Provider value={{
      currentTrack, queue, queueIndex, play, playNext, playPrevious,
      addToQueue, removeFromQueue, clearQueue, stop, playing, togglePlay,
      currentTime, duration, seek, volume, muted, setVolume, toggleMute,
      miniMode, toggleMini,
    }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider')
  return ctx
}
