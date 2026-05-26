import { useState, type CSSProperties } from 'react'
import { assetUrl } from '../../lib/assetUrl'

type Density = 'low' | 'mid' | 'high'

interface Props {
  density?: Density
  glow?: boolean
  className?: string
  style?: CSSProperties
}

const densitySize: Record<Density, number> = { low: 96, mid: 64, high: 40 }

/**
 * Background honeycomb grid. Uses the ComfyUI-generated seamless tile when
 * /art/honeycomb-tile.png is present; otherwise falls back to the CSS
 * @utility `hive-honeycomb` from src/app/mixhive.css.
 *
 * Detection: we eager-load an Image() probe on mount. If the probe fails,
 * we drop into the fallback class.
 */
export function HoneycombGrid({ density = 'mid', glow = false, className, style }: Props) {
  const [hasTile, setHasTile] = useState<boolean | null>(null)

  // Probe once (effect-free; this runs on render but only the first one
  // matters because setState short-circuits subsequent renders).
  if (hasTile === null && typeof window !== 'undefined') {
    const probe = new window.Image()
    probe.onload = () => setHasTile(true)
    probe.onerror = () => setHasTile(false)
    probe.src = assetUrl('honeycomb-tile')
  }

  const sizePx = densitySize[density]

  const tiledStyle: CSSProperties = hasTile
    ? {
        backgroundImage: `url(${assetUrl('honeycomb-tile')})`,
        backgroundRepeat: 'repeat',
        backgroundSize: `${sizePx}px ${sizePx}px`,
      }
    : {}

  return (
    <div
      aria-hidden="true"
      className={hasTile ? className : `hive-honeycomb ${className ?? ''}`.trim()}
      style={{
        position: 'absolute',
        inset: 0,
        opacity: glow ? 0.55 : 0.32,
        pointerEvents: 'none',
        mixBlendMode: 'screen',
        ...tiledStyle,
        ...style,
      }}
    />
  )
}
