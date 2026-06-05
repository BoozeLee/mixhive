import React, { useState } from 'react';
import { colors, fontSize, fontWeight, radius, space } from '@/styles/tokens';
import type { TrackCell } from '@/components/composer/ComposerCanvas';

interface ComposerAgentPanelProps {
  tracks: TrackCell[];
  visible: boolean;
}

interface AgentResult {
  analysis: string;
  mix_count: number;
}

export function ComposerAgentPanel({ tracks, visible }: ComposerAgentPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canAnalyse = tracks.length >= 3;

  async function handleAnalyse() {
    if (!canAnalyse) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/lua-agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: 'set_composer_agent',
          event: {
            event_type: 'manual',
            mix_ids: tracks.map(t => t.mix_id),
            bpm_map: Object.fromEntries(tracks.filter(t => t.bpm).map(t => [t.mix_id, t.bpm])),
          },
        }),
      });

      if (!res.ok) throw new Error('Agent request failed');
      const data = (await res.json()) as { suggestions?: AgentResult[] };
      const suggestion = data.suggestions?.[0];
      if (suggestion) {
        setResult(suggestion);
      } else {
        setResult({
          analysis: 'No analysis available for this set yet.',
          mix_count: tracks.length,
        });
      }
    } catch {
      setError('Could not reach the set analysis agent. Try again shortly.');
    } finally {
      setLoading(false);
    }
  }

  if (!visible) return null;

  return (
    <div
      className="panel-enter"
      style={{
        width: 340,
        background: colors.surface,
        borderLeft: `1px solid ${colors.border}`,
        padding: `${space[10]}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: space[8],
        flexShrink: 0,
        height: '100%',
        overflowY: 'auto',
      }}
    >
      <h3
        style={{
          fontSize: fontSize.md,
          fontWeight: fontWeight.semibold,
          color: colors.text.primary,
          margin: 0,
        }}
      >
        ⚡ Set Analysis
      </h3>

      <p style={{ fontSize: fontSize.sm, color: colors.text.muted, margin: 0 }}>
        {canAnalyse
          ? `${tracks.length} track${tracks.length !== 1 ? 's' : ''} in your set.`
          : 'Add at least 3 tracks to analyse your set.'}
      </p>

      <button
        type="button"
        onClick={handleAnalyse}
        disabled={!canAnalyse || loading}
        style={{
          padding: `${space[6]}px ${space[10]}px`,
          background: canAnalyse && !loading ? colors.accentFaint : colors.surface,
          border: `1px solid ${canAnalyse && !loading ? colors.accent : colors.border}`,
          borderRadius: radius.md,
          color: canAnalyse && !loading ? colors.accent : colors.text.dim,
          fontSize: fontSize.sm,
          fontWeight: fontWeight.semibold,
          cursor: canAnalyse && !loading ? 'pointer' : 'default',
          transition: '120ms ease',
        }}
      >
        {loading ? 'Analysing…' : 'Analyse my set'}
      </button>

      {error && <p style={{ fontSize: fontSize.sm, color: colors.danger, margin: 0 }}>{error}</p>}

      {result && (
        <div
          style={{
            background: colors.accentFaint,
            border: `1px solid ${colors.accentMuted}`,
            borderLeft: `4px solid ${colors.accent}`,
            borderRadius: radius.md,
            padding: `${space[8]}px`,
          }}
        >
          <p
            style={{
              fontSize: fontSize.sm,
              color: colors.text.primary,
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            {result.analysis}
          </p>
        </div>
      )}

      {tracks.length > 0 && (
        <div style={{ marginTop: 'auto' }}>
          <h4
            style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.semibold,
              color: colors.text.muted,
              margin: `0 0 ${space[6]}px`,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Tracks in set
          </h4>
          <ol
            style={{
              margin: 0,
              padding: '0 0 0 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {tracks.map((t, i) => (
              <li key={t.mix_id} style={{ fontSize: fontSize.xs, color: colors.text.secondary }}>
                <span style={{ color: colors.text.dim }}>{i + 1}. </span>
                {t.title}
                {t.bpm && <span style={{ color: colors.text.dim }}> · {t.bpm} BPM</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
