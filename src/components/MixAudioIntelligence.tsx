import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { colors, withAlpha } from '../styles/tokens';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAgentStream } from '../lib/useAgentStream';
import { useAgentStore } from '../lib/agentStore';
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
  const t = useTranslations('mixAudioIntelligence');
  const [feature, setFeature] = useState<AudioFeature | null>(null);
  const [tracks, setTracks] = useState<MixTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const stream = useAgentStream();

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

  useEffect(() => {
    const unsub = useAgentStore.getState().subscribe(mix.dj_id);
    return unsub;
  }, [mix.dj_id]);

  useEffect(() => {
    useAgentStore.getState().setRunning(stream.running);
  }, [stream.running]);

  useEffect(() => {
    if (stream.suggestions.length > 0) {
      useAgentStore.getState().addSuggestions(
        stream.suggestions.map((s, i) => ({
          id: `stream-${mix.id}-${i}`,
          type: s.type,
          payload: (s.payload ?? {}) as Record<string, unknown>,
          rationale: s.rationale ?? null,
          confidence: s.confidence ?? 0,
          status: 'pending' as const,
          source: 'dj_set_analyzer',
          created_at: new Date().toISOString(),
        }))
      );
    }
  }, [stream.suggestions, mix.id]);

  async function runAiSetAnalysis() {
    const bustCache = stream.complete;
    useAgentStore.getState().setRunning(true);
    useAgentStore.getState().setError(null);
    stream.start(mix.id, { agentId: 'dj_set_analyzer', context: { audio_features: feature ?? undefined, mix_title: mix.title, genre: mix.genre_name ?? null }, bustCache });
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
        border: '1px solid rgba(246,196,0,0.28)',
        borderRadius: 10,
        background:
          'linear-gradient(135deg, rgba(246,196,0,0.08), transparent 36%), rgba(10,10,8,0.82)',
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
            {t('djSetAnalyzer')}
          </div>
          <h2 style={{ margin: '4px 0 0', color: colors.text.primary, fontSize: 17 }}>
            {t('audioIntelligence')}
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
              disabled={stream.running}
              style={{
                border: '1px solid rgba(246,196,0,0.5)',
                borderRadius: 8,
                background: stream.running ? colors.surfaceRaised : 'transparent',
                color: stream.running ? colors.text.faintest : colors.accent,
                padding: '8px 12px',
                fontWeight: 800,
                fontSize: 12,
                cursor: stream.running ? 'default' : 'pointer',
              }}
            >
              {stream.running ? (stream.statusMessage || 'Running AI…') : stream.complete ? 'Run again' : 'AI Set Analysis'}
            </button>
          </div>
        )}
      </div>

      {loading && <p style={{ color: colors.text.dim, fontSize: 13 }}>{t('loadingAnalyzer')}</p>}
      {message && <p style={{ color: colors.accent, fontSize: 13, lineHeight: 1.5 }}>{message}</p>}

      {feature?.status === 'processing' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 16,
            padding: 12,
            borderRadius: 8,
            background: withAlpha(colors.accent, 0.08),
            border: `1px solid ${colors.border}`,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>⏳</span>
          <span style={{ color: colors.text.muted, fontSize: 13 }}>
            Audio intelligence is processing...
          </span>
        </div>
      )}

      {feature?.status === 'failed' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 16,
            padding: 12,
            borderRadius: 8,
            background: 'rgba(255,68,68,0.08)',
            border: '1px solid rgba(255,68,68,0.25)',
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>⚠️</span>
          <span style={{ color: colors.text.muted, fontSize: 13 }}>
            {feature.error_message || 'Analysis failed.'}
          </span>
        </div>
      )}

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
                    fontSize: 11,
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
                {t('structurePreview')}
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
                {t('recognizedTracklist')}
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

      {stream.error && <p style={{ marginTop: 12, color: colors.danger, fontSize: 13 }}>{stream.error}</p>}

      {stream.suggestions.length > 0 && (
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
            {t('aiSetIntelligence')}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {stream.suggestions.slice(0, 3).map((s, i) => (
              <div
                key={i}
                style={{
                  border: `1px solid ${colors.borderSubtle}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  background: 'rgba(246,196,0,0.04)',
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
          {stream.suggestions.length > 3 && (
            <p style={{ marginTop: 8, color: colors.text.faintest, fontSize: 12 }}>
              +{stream.suggestions.length - 3} more in{' '}
              <a href="/agents/inbox" style={{ color: colors.accent }}>
                agents inbox
              </a>
            </p>
          )}
        </div>
      )}

      {stream.complete && stream.suggestions.length === 0 && (
        <p style={{ marginTop: 12, color: colors.text.faintest, fontSize: 13 }}>
          AI analysis complete — no specific suggestions at this time.
        </p>
      )}
    </section>
  );
}
