import { useMemo } from 'react'

interface Props {
  /** Pre-computed bar heights, each 0..1. If absent, a soft sine fallback is used. */
  peaks?: number[]
  /** Number of bars to render — overrides peaks.length if both provided. */
  bars?: number
  height?: number
  /** Optional accessible label. When omitted, the bar is presentational. */
  label?: string
  /** Render the playhead at this fraction (0..1) across the bar. */
  progress?: number
  className?: string
}

const DEFAULT_BARS = 64

/**
 * Beat-bar waveform display — 64 amber columns. Until the audio-reactive
 * hook ships (Phase 5), `peaks` are static. Used inline on cards / list rows.
 */
export function WaveBar({ peaks, bars = DEFAULT_BARS, height = 36, label, progress = 0, className }: Props) {
  const heights = useMemo(() => {
    const n = peaks?.length ?? bars
    if (peaks && peaks.length) return peaks.slice(0, bars).concat(
      Array(Math.max(0, bars - peaks.length)).fill(0)
    )
    // Soft sinusoidal fallback
    return Array.from({ length: n }, (_, i) => 0.35 + 0.45 * Math.abs(Math.sin(i * 0.45)))
  }, [peaks, bars])

  const playheadX = Math.max(0, Math.min(1, progress))

  return (
    <div
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 1.5,
        width: '100%',
        height,
        position: 'relative',
      }}
    >
      {heights.map((h, i) => {
        const played = i / heights.length < playheadX
        return (
          <span
            key={i}
            aria-hidden="true"
            style={{
              flex: 1,
              height: `${Math.max(8, Math.min(100, h * 100))}%`,
              borderRadius: 1,
              background: played
                ? 'var(--hive-gold-hot, #ffd84a)'
                : 'var(--hive-gold, #f6c400)',
              opacity: played ? 1 : 0.78,
              boxShadow: played ? '0 0 6px rgba(246,196,0,0.5)' : 'none',
              transition: 'background 80ms linear',
            }}
          />
        )
      })}
      {progress > 0 && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${playheadX * 100}%`,
            width: 2,
            background: 'var(--hive-gold-hot, #ffd84a)',
            boxShadow: '0 0 8px var(--hive-glow, rgba(246,196,0,0.55))',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}
