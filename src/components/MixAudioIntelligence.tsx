import { useEffect, useState } from 'react';
import { colors } from '../styles/tokens';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { runStrategicAgent } from '../lib/agents';
import type { AgentOutput } from '../lib/agents';
import type { AudioFeature, Mix, MixTrack } from '../lib/types';

interface Props {
  mix: Mix;
  isOwner: boolean;
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function MixAudioIntelligence({ mix, isOwner }: Props) {
  const [feature, setFeature] = useState<AudioFeature | null>(null);
  const [tracks, setTracks] = useState<MixTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AgentOutput | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/audio-intelligence/${mix.id}`)
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to load audio intelligence');
        return body as {
          feature: AudioFeature | null;
          tracks: MixTrack[];
          setup_required?: boolean;
          message?: string;
        };
      })
      .then(body => {
        if (!alive) return;
        setFeature(body.feature);
        setTracks(body.tracks || []);
        setMessage(
          body.setup_required
            ? body.message || 'Audio intelligence storage is not ready yet.'
            : null
        );
      })
      .catch(err => {
        if (alive)
          setMessage(err instanceof Error ? err.message : 'Unable to load audio intelligence');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [mix.id]);

  async function runAiSetAnalysis() {
    setAiBusy(true);
    setAiError(null);
    try {
      const result = await runStrategicAgent('dj_set_analyzer', { mix_id: mix.id }, false);
      setAiAnalysis(result);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI analysis failed');
    } finally {
      setAiBusy(false);
    }
  }

  async function analyze() {
    if (!isSupabaseConfigured) {
      setMessage('Supabase is not configured for audio intelligence.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sign in again to analyze this mix.');
      const response = await fetch(`/api/audio-intelligence/${mix.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || body.error || 'Analysis failed');
      setFeature(body.feature);
      setTracks(body.tracks || []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setBusy(false);
    }
  }

  const sections = feature?.structure_json.sections || [];

  return (
    <section
      style={{
        marginTop: 24,
        border: '1px solid rgba(240,192,64,0.28)',
        borderRadius: 12,
        background:
          'linear-gradient(135deg, rgba(240,192,64,0.08), transparent 36%), rgba(10,10,8,0.82)',
        padding: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              color: colors.accent,
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
            }}
          >
            DJ Set Analyzer
          </div>
          <h2 style={{ margin: '4px 0 0', color: colors.text.primary, fontSize: 17 }}>
            Audio intelligence
          </h2>
        </div>
        {isOwner && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={analyze}
              disabled={busy}
              style={{
                border: `1px solid ${colors.accent}`,
                borderRadius: 8,
                background: busy ? colors.borderStrong : colors.accent,
                color: busy ? colors.text.muted : colors.bg,
                padding: '8px 12px',
                fontWeight: 800,
                fontSize: 12,
                cursor: busy ? 'default' : 'pointer',
              }}
            >
              {busy ? 'Analyzing...' : feature ? 'Re-analyze' : 'Analyze mix'}
            </button>
            <button
              type="button"
              onClick={runAiSetAnalysis}
              disabled={aiBusy}
              style={{
                border: '1px solid rgba(240,192,64,0.5)',
                borderRadius: 8,
                background: aiBusy ? colors.surfaceRaised : 'transparent',
                color: aiBusy ? colors.text.faintest : colors.accent,
                padding: '8px 12px',
                fontWeight: 800,
                fontSize: 12,
                cursor: aiBusy ? 'default' : 'pointer',
              }}
            >
              {aiBusy ? 'Running AI…' : 'AI Set Analysis'}
            </button>
          </div>
        )}
      </div>

      {loading && <p style={{ color: colors.text.dim, fontSize: 13 }}>Loading analyzer...</p>}
      {message && <p style={{ color: colors.accent, fontSize: 13, lineHeight: 1.5 }}>{message}</p>}

      {!loading && !feature && !message && (
        <p style={{ color: colors.text.dim, fontSize: 13, lineHeight: 1.5 }}>
          No analysis yet. The MVP starts with BPM, key, mood, energy and structure. AudD/Essentia
          tracklisting can plug into this same panel later.
        </p>
      )}

      {feature && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
              gap: 10,
              marginTop: 16,
            }}
          >
            {[
              ['BPM', feature.bpm ? Math.round(feature.bpm).toString() : '--'],
              ['Key', feature.camelot || feature.musical_key || '--'],
              ['Mood', feature.mood || '--'],
              ['Energy', feature.energy != null ? `${Math.round(feature.energy * 100)}%` : '--'],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  border: `1px solid ${colors.borderSubtle}`,
                  borderRadius: 10,
                  padding: 12,
                  background: 'rgba(0,0,0,0.22)',
                }}
              >
                <div
                  style={{
                    color: colors.text.faint,
                    fontSize: 10,
                    textTransform: 'uppercase',
                    fontWeight: 800,
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    color: colors.text.primary,
                    fontSize: 17,
                    fontWeight: 800,
                    marginTop: 4,
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>

          {sections.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ color: colors.text.dimmed, fontSize: 12, marginBottom: 8 }}>
                Structure preview
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {sections.map(section => (
                  <div
                    key={`${section.label}-${section.start_sec}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '78px 1fr 54px',
                      gap: 10,
                      alignItems: 'center',
                      color: colors.text.muted,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: colors.text.secondary, textTransform: 'capitalize' }}>
                      {section.label}
                    </span>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 999,
                        background: colors.surfaceRaised,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.round(section.energy * 100)}%`,
                          height: '100%',
                          background: colors.accent,
                        }}
                      />
                    </div>
                    <span>{formatTime(section.start_sec)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tracks.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ color: colors.text.dimmed, fontSize: 12, marginBottom: 8 }}>
                Recognized tracklist
              </div>
              {tracks.map(track => (
                <div
                  key={track.id}
                  style={{
                    color: colors.text.muted,
                    fontSize: 12,
                    padding: '6px 0',
                    borderTop: `1px solid ${colors.surfaceRaised}`,
                  }}
                >
                  {formatTime(track.start_sec)} · {track.artist || 'Unknown'} -{' '}
                  {track.title || 'Untitled'}
                </div>
              ))}
            </div>
          )}

          <p
            style={{
              margin: '14px 0 0',
              color: colors.text.faintest,
              fontSize: 11,
              lineHeight: 1.5,
            }}
          >
            Source: {feature.source}. This is a confidence-scored preview, not copyright or
            licensing advice.
          </p>
        </>
      )}

      {aiError && <p style={{ marginTop: 12, color: colors.danger, fontSize: 13 }}>{aiError}</p>}

      {aiAnalysis && aiAnalysis.suggestions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              color: colors.accent,
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              marginBottom: 10,
            }}
          >
            AI Set Intelligence
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {aiAnalysis.suggestions.slice(0, 3).map((s, i) => (
              <div
                key={i}
                style={{
                  border: `1px solid ${colors.borderSubtle}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  background: 'rgba(240,192,64,0.04)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      color: colors.accent,
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {s.type.replace(/_/g, ' ')}
                  </span>
                  <span style={{ color: colors.text.faintest, fontSize: 11 }}>
                    {Math.round(s.confidence * 100)}% confidence
                  </span>
                </div>
                <p
                  style={{ margin: 0, color: colors.text.secondary, fontSize: 13, lineHeight: 1.5 }}
                >
                  {s.rationale}
                </p>
              </div>
            ))}
          </div>
          {aiAnalysis.suggestions.length > 3 && (
            <p style={{ marginTop: 8, color: colors.text.faintest, fontSize: 12 }}>
              +{aiAnalysis.suggestions.length - 3} more in{' '}
              <a href="/agents/inbox" style={{ color: colors.accent }}>
                agents inbox
              </a>
            </p>
          )}
        </div>
      )}

      {aiAnalysis && aiAnalysis.suggestions.length === 0 && aiAnalysis.status === 'ok' && (
        <p style={{ marginTop: 12, color: colors.text.faintest, fontSize: 13 }}>
          AI analysis complete — no specific suggestions at this time.
        </p>
      )}
    </section>
  );
}
