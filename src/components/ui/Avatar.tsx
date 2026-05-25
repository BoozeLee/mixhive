import { colors, radius } from '../../styles/tokens'

interface Props {
  src?: string | null
  name?: string | null
  size?: number
  /** When false, render a square instead of a circle (e.g. mix artwork). */
  rounded?: boolean
  alt?: string
}

function initialsFor(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar({ src, name, size = 40, rounded = true, alt }: Props) {
  const dim = { width: size, height: size }
  const altText = alt ?? (name ? `${name}'s avatar` : '')

  if (src) {
    return (
      <img
        src={src}
        alt={altText}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        style={{
          ...dim,
          borderRadius: rounded ? '50%' : radius.md,
          objectFit: 'cover',
          background: colors.surface,
          flexShrink: 0,
        }}
      />
    )
  }

  return (
    <div
      role="img"
      aria-label={altText}
      style={{
        ...dim,
        borderRadius: rounded ? '50%' : radius.md,
        background: `linear-gradient(135deg, ${colors.surfaceHover}, ${colors.accentFaint})`,
        color: colors.text.muted,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: Math.max(10, Math.floor(size * 0.36)),
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {initialsFor(name)}
    </div>
  )
}
