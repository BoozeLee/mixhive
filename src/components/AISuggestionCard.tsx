import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { AISuggestion } from '../lib/types'
import { colors, space, radius, fontSize, fontWeight, transition } from '../styles/tokens'

const typeLabels: Record<string, string> = {
  profile_bio: 'Bio',
  profile_coach: 'Profile Coach',
  epk: 'Press Kit',
  opportunity_match: 'Opportunity',
  collab_match: 'Collaboration',
}

const typeIcons: Record<string, string> = {
  profile_bio: '✎',
  profile_coach: '⬡',
  epk: '◈',
  opportunity_match: '◇',
  collab_match: '✦',
}

interface Props {
  suggestion: AISuggestion
  onApply?: (id: string) => void
  onReject?: (id: string) => void
  onRate?: (id: string, rating: number) => void
}

function ConfidenceBar({ value }: { value: number | null }) {
  if (value === null) return null
  const pct = Math.round(value * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
      <div
        style={{
          flex: 1,
          height: 3,
          borderRadius: radius.pill,
          background: colors.border,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: pct >= 70 ? colors.accent : pct >= 40 ? colors.warning : colors.text.muted,
            borderRadius: radius.pill,
            transition: transition.slow,
          }}
        />
      </div>
      <span style={{ fontSize: fontSize.xs, color: colors.text.dim, flexShrink: 0 }}>{pct}%</span>
    </div>
  )
}

function SuggestionBody({ suggestion }: { suggestion: AISuggestion }) {
  const p = suggestion.payload

  if (suggestion.suggestion_type === 'profile_coach') {
    const suggestions = p.suggestions as Array<{field: string; issue: string; suggestion: string; priority: number}> | undefined
    const bioRewrite = p.bio_rewrite as string | null | undefined
    const score = p.score as number | undefined
    const headline = p.headline as string | undefined

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[6] }}>
        {score !== undefined && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: space[4] }}>
            <span style={{ fontSize: fontSize['3xl'], fontWeight: fontWeight.bold, color: score >= 70 ? colors.accent : score >= 40 ? colors.warning : colors.text.muted }}>
              {score}
            </span>
            <span style={{ fontSize: fontSize.sm, color: colors.text.dim, textTransform: 'uppercase', letterSpacing: 1 }}>
              /100 · {headline}
            </span>
          </div>
        )}

        {suggestions?.map((s, i) => (
          <div key={i} style={{
            padding: `${space[4]}px ${space[5]}px`,
            borderRadius: radius.md,
            background: s.priority === 1 ? 'rgba(255,85,85,0.06)' : colors.accentFaint,
            border: `1px solid ${s.priority === 1 ? 'rgba(255,85,85,0.2)' : colors.accentMuted}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: space[3], marginBottom: space[2] }}>
              <span style={{
                fontSize: fontSize.xs,
                color: s.priority === 1 ? colors.danger : colors.accent,
                fontWeight: fontWeight.bold,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
              }}>
                {s.priority === 1 ? '● Critical' : s.priority === 2 ? '◐ Important' : '○ Optional'} · {s.field}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: fontSize.base, color: colors.text.secondary, marginBottom: space[2] }}>{s.issue}</p>
            <p style={{ margin: 0, fontSize: fontSize.base, color: colors.text.primary }}>{s.suggestion}</p>
          </div>
        ))}

        {bioRewrite && (
          <div style={{
            padding: `${space[4]}px ${space[5]}px`,
            borderRadius: radius.md,
            background: 'rgba(240,192,64,0.04)',
            border: `1px solid ${colors.accentMuted}`,
          }}>
            <div style={{ fontSize: fontSize.xs, color: colors.accent, fontWeight: fontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: space[3] }}>
              ✎ Suggested bio rewrite
            </div>
            <p style={{ margin: 0, fontSize: fontSize.base, color: colors.text.primary, lineHeight: 1.6, fontStyle: 'italic' }}>"{bioRewrite}"</p>
          </div>
        )}
      </div>
    )
  }

  if (suggestion.suggestion_type === 'profile_bio') {
    const bio = p.bio as string | undefined
    return bio ? (
      <p style={{ margin: 0, fontSize: fontSize.base, color: colors.text.primary, lineHeight: 1.6, fontStyle: 'italic' }}>"{bio}"</p>
    ) : null
  }

  // Generic fallback
  return (
    <pre style={{ margin: 0, fontSize: fontSize.xs, color: colors.text.muted, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {JSON.stringify(p, null, 2)}
    </pre>
  )
}

function StarRating({ onRate }: { onRate: (r: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div style={{ display: 'flex', gap: space[1] }}>
      {[1,2,3,4,5].map(n => (
        <button
          key={n}
          aria-label={`Rate ${n} stars`}
          onClick={() => onRate(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          style={{
            background: 'none',
            border: 'none',
            padding: `${space[1]}px`,
            cursor: 'pointer',
            fontSize: 16,
            color: n <= hovered ? colors.accent : colors.text.faint,
            transition: transition.fast,
          }}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export function AISuggestionCard({ suggestion, onApply, onReject, onRate }: Props) {
  const [showRationale, setShowRationale] = useState(false)
  const [localStatus, setLocalStatus] = useState(suggestion.status)
  const [rated, setRated] = useState(false)

  const isApplied = localStatus === 'applied'
  const isRejected = localStatus === 'rejected'
  const isDone = isApplied || isRejected

  const label = typeLabels[suggestion.suggestion_type] ?? suggestion.suggestion_type
  const icon = typeIcons[suggestion.suggestion_type] ?? '✦'

  function handleApply() {
    setLocalStatus('applied')
    onApply?.(suggestion.id)
  }

  function handleReject() {
    setLocalStatus('rejected')
    onReject?.(suggestion.id)
  }

  function handleRate(r: number) {
    setRated(true)
    onRate?.(suggestion.id, r)
  }

  return (
    <article
      style={{
        background: 'linear-gradient(135deg, rgba(255,216,74,0.06), transparent 32%), linear-gradient(180deg, rgba(255,255,255,0.02), transparent), rgba(7,7,5,0.78)',
        border: `1px solid ${isDone ? colors.border : colors.accentMuted}`,
        borderRadius: radius.xl,
        padding: `${space[7]}px ${space[8]}px`,
        opacity: isRejected ? 0.5 : 1,
        transition: transition.slow,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: space[5], marginBottom: space[6] }}>
        <div style={{
          width: 32, height: 32, display: 'grid', placeItems: 'center', flexShrink: 0,
          clipPath: 'polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%)',
          background: isDone ? colors.border : colors.accentFaint,
          color: isDone ? colors.text.faint : colors.accent,
          border: `1px solid ${isDone ? colors.border : colors.accentMuted}`,
          fontSize: 14, fontWeight: fontWeight.bold,
        }}>
          {isApplied ? '✓' : isRejected ? '✗' : icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: space[4], marginBottom: space[2] }}>
            <span style={{
              fontSize: fontSize.xs, fontWeight: fontWeight.bold,
              textTransform: 'uppercase', letterSpacing: 1,
              color: isApplied ? colors.success : isRejected ? colors.text.faint : colors.accent,
            }}>
              {isApplied ? 'Applied' : isRejected ? 'Dismissed' : label}
            </span>
            {suggestion.model && !isDone && (
              <span style={{ fontSize: fontSize.xs, color: colors.text.faint }}>via {suggestion.model}</span>
            )}
          </div>
          <ConfidenceBar value={suggestion.confidence} />
        </div>
      </div>

      {/* Body */}
      {!isRejected && (
        <div style={{ marginBottom: space[6] }}>
          <SuggestionBody suggestion={suggestion} />
        </div>
      )}

      {/* Rationale accordion */}
      {suggestion.rationale && !isRejected && (
        <div style={{ marginBottom: space[6] }}>
          <button
            onClick={() => setShowRationale(v => !v)}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontSize: fontSize.xs, color: colors.text.muted,
              display: 'flex', alignItems: 'center', gap: space[2],
              textDecoration: 'underline', textDecorationColor: colors.accentMuted,
              transition: transition.fast,
            }}
          >
            {showRationale ? '▲' : '▼'} Why this analysis?
          </button>
          {showRationale && (
            <p style={{
              margin: `${space[4]}px 0 0`,
              fontSize: fontSize.base, color: colors.text.muted, lineHeight: 1.6,
              paddingLeft: space[5], borderLeft: `2px solid ${colors.accentMuted}`,
            }}>
              {suggestion.rationale}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      {!isDone ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: space[4], flexWrap: 'wrap' }}>
          {suggestion.suggestion_type === 'profile_coach' && (
            <Link
              to="/settings"
              style={{
                padding: `${space[3]}px ${space[7]}px`,
                borderRadius: radius.md,
                background: `linear-gradient(135deg, #ffde4d, ${colors.accent} 58%, #b96a00)`,
                color: '#050505',
                fontWeight: fontWeight.bold,
                fontSize: fontSize.base,
                textDecoration: 'none',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Apply suggestions
            </Link>
          )}
          {suggestion.suggestion_type !== 'profile_coach' && onApply && (
            <button
              onClick={handleApply}
              style={{
                padding: `${space[3]}px ${space[7]}px`,
                borderRadius: radius.md,
                background: `linear-gradient(135deg, #ffde4d, ${colors.accent} 58%, #b96a00)`,
                color: '#050505',
                fontWeight: fontWeight.bold,
                fontSize: fontSize.base,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Apply
            </button>
          )}
          <button
            onClick={handleReject}
            style={{
              padding: `${space[3]}px ${space[6]}px`,
              borderRadius: radius.md,
              background: 'transparent',
              border: `1px solid ${colors.border}`,
              color: colors.text.muted,
              fontWeight: fontWeight.medium,
              fontSize: fontSize.base,
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
          {!rated && onRate && (
            <StarRating onRate={handleRate} />
          )}
          {rated && (
            <span style={{ fontSize: fontSize.xs, color: colors.text.muted }}>Thanks for the feedback</span>
          )}
        </div>
      ) : (
        isApplied && !rated && onRate && (
          <div style={{ display: 'flex', alignItems: 'center', gap: space[4] }}>
            <span style={{ fontSize: fontSize.xs, color: colors.text.muted }}>How useful was this?</span>
            <StarRating onRate={handleRate} />
          </div>
        )
      )}
    </article>
  )
}
