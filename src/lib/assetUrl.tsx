// Brand asset resolver.
//
// ComfyUI-generated artwork lives at `public/art/...` (see assets/comfy-workflows/
// and docs/COMFY_ASSETS.md). Those files are produced manually by an operator
// running the workflows locally; in CI / fresh-clone / pre-generation builds
// they don't exist yet.
//
// We don't want the UI to break when an asset is missing. This module:
//   - returns the public URL of each named asset
//   - keeps a `fallback` URL for every named asset (a public/ file that always
//     ships, or a built-in inline SVG marker)
//   - exposes <ImageWithFallback> that swaps to the fallback on the natural
//     <img onError> trigger so the swap is automatic when production prebuilds
//     and the asset hasn't landed yet.

import { useState, type ImgHTMLAttributes } from 'react'

export type BrandAsset =
  | 'logo-crown-m'
  | 'honeycomb-tile'
  | 'bee-swarm'
  | 'hero-plate'
  | `icon-${IconName}`

export type IconName =
  | 'hive-feed'
  | 'swarm-chat'
  | 'nectar-upload'
  | 'queen-mode'
  | 'mix-vault'
  | 'vinyl-marketplace'
  | 'buzz-alerts'
  | 'hive-radar'
  | 'beecast-live'
  | 'honeydrop-nft'

/** Canonical primary URL for each branded asset. */
export function assetUrl(name: BrandAsset): string {
  if (name === 'logo-crown-m')    return '/art/logo-crown-m@2x.png'
  if (name === 'honeycomb-tile')  return '/art/honeycomb-tile.png'
  if (name === 'bee-swarm')       return '/art/bee-swarm.png'
  if (name === 'hero-plate')      return '/art/hero-plate@3x.jpg'
  // icon-<slug>
  const slug = name.slice('icon-'.length)
  return `/art/icons/${slug}.svg`
}

/** Always-shipping fallback URL or null (caller renders an inline SVG marker). */
export function assetFallback(name: BrandAsset): string | null {
  if (name === 'logo-crown-m')   return '/mixhive.png'
  if (name === 'honeycomb-tile') return null   // CSS @utility hive-honeycomb handles it
  if (name === 'bee-swarm')      return null
  if (name === 'hero-plate')     return null
  // icons fall back to inline SVG (HexIcon owns that)
  return null
}

interface ImgFbProps extends ImgHTMLAttributes<HTMLImageElement> {
  asset: BrandAsset
}

/**
 * <ImageWithFallback> — drop-in <img> that swaps to assetFallback() on error.
 * If both primary and fallback fail to load, the element renders invisibly
 * (alt text remains for a11y).
 */
export function ImageWithFallback({ asset, alt = '', ...rest }: ImgFbProps) {
  const primary = assetUrl(asset)
  const fb = assetFallback(asset)
  const [src, setSrc] = useState(primary)
  const [stage, setStage] = useState<'primary' | 'fallback' | 'gone'>('primary')

  return (
    <img
      src={src}
      alt={alt}
      onError={() => {
        if (stage === 'primary' && fb) {
          setSrc(fb)
          setStage('fallback')
        } else {
          setStage('gone')
        }
      }}
      style={{
        ...rest.style,
        visibility: stage === 'gone' ? 'hidden' : undefined,
      }}
      {...rest}
    />
  )
}
