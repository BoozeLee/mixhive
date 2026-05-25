import { useState } from 'react'
import { usePlayer } from '../lib/playerStore'
import { PlayerQueue } from './PlayerQueue'

export function GlobalPlayer() {
  const {
    currentTrack, playing, togglePlay, stop, currentTime, duration, seek,
    playNext, playPrevious, volume, muted, setVolume, toggleMute,
    miniMode, toggleMini, queue,
  } = usePlayer()
  const [showQueue, setShowQueue] = useState(false)

  if (!currentTrack) return null

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    if (!duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    seek(pct * duration)
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const hasQueue = queue.length > 0

  // Mini mode
  if (miniMode) {
    return (
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#0f0f0f',
        borderTop: '1px solid #1a1a2e',
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        zIndex: 200,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 4, flexShrink: 0,
          background: currentTrack.artworkUrl
            ? `url(${currentTrack.artworkUrl}) center/cover`
            : 'linear-gradient(135deg, #1a1a2e, #f0c04022)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: '#f0c04044',
        }}>
          {!currentTrack.artworkUrl && '♪'}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#eee', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentTrack.title}
          </div>
        </div>
        <button onClick={togglePlay} style={{
          width: 28, height: 28, borderRadius: '50%', border: 'none',
          background: '#f0c040', color: '#0a0a0a', fontSize: 12,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {playing ? '⏸' : '▶'}
        </button>
        <button onClick={toggleMini} style={{
          background: 'transparent', border: 'none', color: '#555', fontSize: 14, cursor: 'pointer', padding: 2,
        }} title="Expand">
          ▲
        </button>
      </div>
    )
  }

  return (
    <>
      {showQueue && <PlayerQueue />}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#0f0f0f',
        borderTop: '1px solid #1a1a2e',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        zIndex: 200,
      }}>
        {/* Artwork */}
        <div style={{
          width: 40, height: 40, borderRadius: 6, flexShrink: 0,
          background: currentTrack.artworkUrl
            ? `url(${currentTrack.artworkUrl}) center/cover`
            : 'linear-gradient(135deg, #1a1a2e, #f0c04022)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, color: '#f0c04044',
        }}>
          {!currentTrack.artworkUrl && '♪'}
        </div>

        {/* Track info */}
        <div style={{ minWidth: 0, width: 160, flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#eee', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentTrack.title}
          </div>
          <div style={{ fontSize: 11, color: '#888' }}>
            {currentTrack.djName}
          </div>
        </div>

        {/* Prev / Play-Pause / Next */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button onClick={playPrevious} style={{
            background: 'transparent', border: 'none', color: '#888', fontSize: 14,
            cursor: 'pointer', padding: '4px 6px', lineHeight: 1,
          }} title="Previous">
            ⏮
          </button>
          <button onClick={togglePlay} style={{
            width: 34, height: 34, borderRadius: '50%', border: 'none',
            background: '#f0c040', color: '#0a0a0a', fontSize: 14,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {playing ? '⏸' : '▶'}
          </button>
          <button onClick={playNext} style={{
            background: 'transparent', border: 'none', color: '#888', fontSize: 14,
            cursor: 'pointer', padding: '4px 6px', lineHeight: 1,
          }} title="Next">
            ⏭
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ flex: 1, minWidth: 80 }}>
          <div onClick={handleSeek} style={{
            height: 3, background: '#222', borderRadius: 2, cursor: 'pointer', position: 'relative',
          }}>
            <div style={{
              height: '100%',
              width: duration ? `${(currentTime / duration) * 100}%` : '0%',
              background: '#f0c040', borderRadius: 2, transition: 'width 0.1s linear',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555', marginTop: 2 }}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button onClick={toggleMute} style={{
            background: 'transparent', border: 'none', color: muted ? '#f55' : '#888',
            fontSize: 14, cursor: 'pointer', padding: 2,
          }} title={muted ? 'Unmute' : 'Mute'}>
            {muted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
          </button>
          <input
            type="range" min={0} max={1} step={0.05}
            value={muted ? 0 : volume}
            onChange={e => setVolume(parseFloat(e.target.value))}
            style={{ width: 60, height: 3, accentColor: '#f0c040' }}
            title="Volume"
          />
        </div>

        {/* Queue toggle */}
        {hasQueue && (
          <button onClick={() => setShowQueue(s => !s)} style={{
            background: 'transparent', border: 'none',
            color: showQueue ? '#f0c040' : '#888', fontSize: 13, cursor: 'pointer', padding: 4,
          }} title="Queue">
            ☰
          </button>
        )}

        {/* Mini mode */}
        <button onClick={toggleMini} style={{
          background: 'transparent', border: 'none', color: '#555', fontSize: 12, cursor: 'pointer', padding: 2,
        }} title="Minimize">
          ▼
        </button>

        {/* Close */}
        <button onClick={stop} style={{
          background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, padding: 2, lineHeight: 1,
        }} title="Close">
          ✕
        </button>
      </div>
    </>
  )
}
