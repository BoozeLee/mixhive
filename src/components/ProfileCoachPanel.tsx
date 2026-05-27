import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { AISuggestionCard } from './AISuggestionCard'
import type { AISuggestion } from '../lib/types'
import { colors, space, radius, fontSize, fontWeight, transition } from '../styles/tokens'

async function fetchSuggestions(userId: string): Promise<AISuggestion[]> {
  const { data } = await supabase
    .from('ai_suggestions')
    .select('*')
    .eq('owner_id', userId)
    .eq('suggestion_type', 'profile_coach')
    .order('created_at', { ascending: false })
    .limit(3)
  return (data ?? []) as AISuggestion[]
}

async function callProfileCoach(token: string): Promise<AISuggestion | null> {
  const res = await fetch('/api/ai/profile-coach', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const code = (err as Record<string, string>).error
    if (code === 'no_ai_key') return null
    throw new Error((err as Record<string, string>).error ?? `HTTP ${res.status}`)
  }
  const json = await res.json() as { suggestion: AISuggestion }
  return json.suggestion
}

async function patchSuggestion(token: string, id: string, action: 'apply' | 'reject' | 'rate', rating?: number) {
  await fetch(`/api/ai/suggestions/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, rating }),
  })
}

export function ProfileCoachPanel() {
  const { user } = useAuth()
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noKey, setNoKey] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    fetchSuggestions(user.id)
      .then(setSuggestions)
      .catch(() => setError('Could not load suggestions'))
      .finally(() => setLoading(false))
  }, [user])

  async function generate() {
    if (!user) return
    setGenerating(true)
    setError(null)
    setNoKey(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setError('Not signed in'); return }

      const suggestion = await callProfileCoach(token)
      if (!suggestion) {
        setNoKey(true)
        return
      }
      setSuggestions(prev => [suggestion, ...prev].slice(0, 3))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handleApply(id: string) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    await patchSuggestion(session.access_token, id, 'apply')
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'applied' as const } : s))
  }

  async function handleReject(id: string) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    await patchSuggestion(session.access_token, id, 'reject')
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'rejected' as const } : s))
  }

  async function handleRate(id: string, rating: number) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    await patchSuggestion(session.access_token, id, 'rate', rating)
  }

  const pendingCount = suggestions.filter(s => s.status === 'pending').length

  return (
    <section
      style={{
        background: 'linear-gradient(135deg, rgba(255,216,74,0.06), transparent 32%), linear-gradient(180deg, rgba(255,255,255,0.025), transparent), rgba(7,7,5,0.78)',
        border: `1px solid ${colors.accentMuted}`,
        borderRadius: radius.xl,
        padding: `${space[8]}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: space[7],
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space[6], flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: space[5] }}>
          <div style={{
            width: 36, height: 36, display: 'grid', placeItems: 'center', flexShrink: 0,
            clipPath: 'polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%)',
            background: colors.accentFaint, color: colors.accent,
            border: `1px solid ${colors.accentMuted}`, fontSize: 16,
          }}>
            ⬡
          </div>
          <div>
            <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text.primary }}>
              Profile Coach
              {pendingCount > 0 && (
                <span style={{
                  marginLeft: space[3], display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 18, height: 18, borderRadius: radius.pill,
                  background: colors.accent, color: colors.bg,
                  fontSize: fontSize.xs, fontWeight: fontWeight.bold,
                }}>
                  {pendingCount}
                </span>
              )}
            </div>
            <div style={{ fontSize: fontSize.xs, color: colors.text.muted }}>AI-powered profile analysis · powered by GPT-4o-mini</div>
          </div>
        </div>

        <button
          onClick={generating ? undefined : generate}
          disabled={generating}
          style={{
            padding: `${space[3]}px ${space[7]}px`,
            borderRadius: radius.md,
            background: generating
              ? colors.border
              : `linear-gradient(135deg, #ffde4d, ${colors.accent} 58%, #b96a00)`,
            color: generating ? colors.text.faint : '#050505',
            fontWeight: fontWeight.bold,
            fontSize: fontSize.base,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            cursor: generating ? 'default' : 'pointer',
            transition: transition.base,
            whiteSpace: 'nowrap',
          }}
        >
          {generating ? 'Analysing…' : 'Analyse profile'}
        </button>
      </div>

      {/* States */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: space[4], color: colors.text.muted, fontSize: fontSize.base }}>
          <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
          Loading suggestions…
        </div>
      )}

      {!loading && noKey && (
        <div style={{
          padding: `${space[6]}px ${space[7]}px`,
          borderRadius: radius.md,
          background: colors.surfaceMuted,
          border: `1px solid ${colors.border}`,
          display: 'flex', flexDirection: 'column', gap: space[3],
        }}>
          <span style={{ fontSize: fontSize.base, color: colors.text.secondary }}>
            Add your OpenAI API key to run profile coaching.
          </span>
          <Link
            to="/settings"
            style={{
              fontSize: fontSize.base, color: colors.accent,
              textDecoration: 'underline', textDecorationColor: colors.accentMuted,
            }}
          >
            Settings → AI & Creativity →
          </Link>
        </div>
      )}

      {!loading && error && !noKey && (
        <div style={{ fontSize: fontSize.base, color: colors.danger }}>{error}</div>
      )}

      {!loading && !error && !noKey && suggestions.length === 0 && !generating && (
        <div style={{ fontSize: fontSize.base, color: colors.text.muted, textAlign: 'center', padding: `${space[9]}px 0` }}>
          No coaching reports yet. Click "Analyse profile" to generate your first report.
        </div>
      )}

      {!loading && generating && suggestions.length === 0 && (
        <div style={{ fontSize: fontSize.base, color: colors.text.muted, display: 'flex', alignItems: 'center', gap: space[4] }}>
          <span>Asking GPT-4o-mini to analyse your profile…</span>
        </div>
      )}

      {/* Suggestion cards */}
      {suggestions.map(s => (
        <AISuggestionCard
          key={s.id}
          suggestion={s}
          onApply={handleApply}
          onReject={handleReject}
          onRate={handleRate}
        />
      ))}

      {/* Footer trust note */}
      <p style={{ margin: 0, fontSize: fontSize.xs, color: colors.text.faint, lineHeight: 1.6 }}>
        MixHive AI is assistive, not autonomous. Every suggestion requires your review before anything changes.
      </p>
    </section>
  )
}
