'use client';

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fontSize, space, fontWeight, radius } from '../styles/tokens';
import { HiveButton } from '../components/hive/HiveButton';
import { Icon } from '../components/ui/Icon';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';
import { runStrategicAgent } from '../lib/agents';
import type { AgentOutput } from '../lib/agents';

type RadarTab = 'scene' | 'orbit';

export function SceneRadar() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<RadarTab>('scene');
  const [sceneOutput, setSceneOutput] = useState<AgentOutput | null>(null);
  const [orbitOutput, setOrbitOutput] = useState<AgentOutput | null>(null);
  const [loadingScene, setLoadingScene] = useState(false);
  const [loadingOrbit, setLoadingOrbit] = useState(false);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [orbitError, setOrbitError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const runSceneRadar = useCallback(async () => {
    setLoadingScene(true);
    setSceneError(null);
    try {
      const out = await runStrategicAgent('scene_radar', {}, true);
      setSceneOutput(out);
      setLastRun(new Date());
    } catch (e) {
      setSceneError(e instanceof Error ? e.message : 'Scene Radar failed');
    } finally {
      setLoadingScene(false);
    }
  }, []);

  const runSceneOrbit = useCallback(async () => {
    setLoadingOrbit(true);
    setOrbitError(null);
    try {
      const out = await runStrategicAgent('mythic_scene_orbit', {}, true);
      setOrbitOutput(out);
      setLastRun(new Date());
    } catch (e) {
      setOrbitError(e instanceof Error ? e.message : 'Scene Orbit failed');
    } finally {
      setLoadingOrbit(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    runSceneRadar();
    runSceneOrbit();
  }, [user, runSceneRadar, runSceneOrbit]);

  if (authLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
        }}
      >
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: space[8], color: colors.text.muted }}>
        <p style={{ marginBottom: space[4] }}>Sign in to see your scene radar.</p>
        <HiveButton variant="primary" onClick={() => navigate('/login')}>
          Sign in
        </HiveButton>
      </div>
    );
  }

  const activeOutput = tab === 'scene' ? sceneOutput : orbitOutput;
  const activeLoading = tab === 'scene' ? loadingScene : loadingOrbit;
  const activeError = tab === 'scene' ? sceneError : orbitError;
  const activeRefresh = tab === 'scene' ? runSceneRadar : runSceneOrbit;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: `${space[6]}px ${space[4]}px` }}>
      {/* Header */}
      <div style={{ marginBottom: space[6] }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: space[3],
          }}
        >
          <div>
            <h1
              style={{
                fontSize: fontSize['2xl'],
                fontWeight: fontWeight.bold,
                margin: 0,
                color: colors.text.primary,
              }}
            >
              Scene Radar
            </h1>
            <p
              style={{
                fontSize: fontSize.sm,
                color: colors.text.muted,
                marginTop: 4,
                marginBottom: 0,
              }}
            >
              AI-generated pulse of your local underground scene
              {lastRun && (
                <span style={{ marginLeft: 8, color: colors.text.faint }}>
                  · refreshed {lastRun.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <HiveButton
            variant="secondary"
            onClick={activeRefresh}
            disabled={activeLoading}
            style={{ fontSize: fontSize.sm }}
          >
            {activeLoading ? 'Scanning…' : '↻ Refresh'}
          </HiveButton>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: space[1],
          marginBottom: space[5],
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        {(['scene', 'orbit'] as RadarTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: `${space[2]}px ${space[4]}px`,
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t ? `2px solid ${colors.gold}` : '2px solid transparent',
              color: tab === t ? colors.gold : colors.text.muted,
              fontWeight: tab === t ? fontWeight.semibold : fontWeight.normal,
              fontSize: fontSize.sm,
              cursor: 'pointer',
              textTransform: 'capitalize',
              marginBottom: -1,
            }}
          >
            {t === 'scene' ? 'Scene Pulse' : 'Scene Orbit'}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: `${space[10]}px 0` }}>
          <LoadingSpinner />
        </div>
      )}

      {!activeLoading && activeError && (
        <div
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: radius.md,
            padding: space[4],
            color: '#f87171',
            fontSize: fontSize.sm,
            marginBottom: space[4],
          }}
        >
          <strong>Agent error:</strong> {activeError}
          <HiveButton
            variant="secondary"
            onClick={activeRefresh}
            style={{ marginLeft: space[3], fontSize: 12, padding: '4px 10px' }}
          >
            Retry
          </HiveButton>
        </div>
      )}

      {!activeLoading && activeOutput && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
          {/* Status badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background:
                  activeOutput.status === 'ok'
                    ? '#22c55e'
                    : activeOutput.status === 'error'
                      ? '#ef4444'
                      : '#f59e0b',
              }}
            />
            <span
              style={{
                fontSize: fontSize.xs,
                color: colors.text.muted,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              {activeOutput.status} · {activeOutput.tokens_used} tokens · {activeOutput.duration_ms}
              ms
            </span>
          </div>

          {/* Notifications (scene summaries) */}
          {activeOutput.notifications.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
              {activeOutput.notifications.map((n, i) => (
                <div
                  key={i}
                  style={{
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    padding: space[5],
                  }}
                >
                  <div
                    style={{
                      fontWeight: fontWeight.semibold,
                      fontSize: fontSize.md,
                      marginBottom: space[2],
                    }}
                  >
                    {n.subject}
                  </div>
                  <p
                    style={{
                      color: colors.text.secondary,
                      fontSize: fontSize.sm,
                      margin: 0,
                      lineHeight: 1.6,
                    }}
                  >
                    {n.body}
                  </p>
                  {n.cta_url && (
                    <a
                      href={n.cta_url}
                      style={{
                        display: 'inline-block',
                        marginTop: space[3],
                        fontSize: fontSize.sm,
                        color: colors.gold,
                      }}
                    >
                      {n.cta_url.startsWith('/') ? 'View →' : 'Open →'}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {activeOutput.suggestions.length > 0 && (
            <div>
              <h2
                style={{
                  fontSize: fontSize.md,
                  fontWeight: fontWeight.semibold,
                  marginBottom: space[3],
                  color: colors.text.primary,
                }}
              >
                Recommendations
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
                {activeOutput.suggestions.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      background: colors.surface,
                      border: `1px solid ${colors.borderStrong}`,
                      borderRadius: radius.md,
                      padding: space[4],
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
                          color: colors.gold,
                          fontSize: 11,
                          fontWeight: fontWeight.bold,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        {s.type.replace(/_/g, ' ')}
                      </span>
                      <span style={{ color: colors.text.faint, fontSize: 11 }}>
                        {Math.round(s.confidence * 100)}% confidence
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        color: colors.text.secondary,
                        fontSize: fontSize.sm,
                        lineHeight: 1.6,
                      }}
                    >
                      {s.rationale}
                    </p>
                    {s.requires_approval && (
                      <span
                        style={{
                          display: 'inline-block',
                          marginTop: space[2],
                          fontSize: 11,
                          color: '#f59e0b',
                        }}
                      >
                        ⚡ Requires your approval
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tasks */}
          {activeOutput.tasks.length > 0 && (
            <div>
              <h2
                style={{
                  fontSize: fontSize.md,
                  fontWeight: fontWeight.semibold,
                  marginBottom: space[3],
                  color: colors.text.primary,
                }}
              >
                Suggested Actions
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
                {activeOutput.tasks.map((t, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: colors.surface,
                      border: `1px solid ${colors.border}`,
                      borderRadius: radius.sm,
                      padding: `${space[3]}px ${space[4]}px`,
                    }}
                  >
                    <span style={{ fontSize: fontSize.sm, color: colors.text.primary }}>
                      {t.title}
                    </span>
                    <div style={{ display: 'flex', gap: space[2], alignItems: 'center' }}>
                      {t.due_date && (
                        <span style={{ fontSize: 11, color: colors.text.faint }}>
                          {new Date(t.due_date).toLocaleDateString()}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: fontWeight.bold,
                          textTransform: 'uppercase',
                          padding: '2px 6px',
                          borderRadius: 3,
                          background:
                            t.priority === 'high'
                              ? 'rgba(239,68,68,0.15)'
                              : t.priority === 'medium'
                                ? 'rgba(245,158,11,0.15)'
                                : 'rgba(107,114,128,0.15)',
                          color:
                            t.priority === 'high'
                              ? '#f87171'
                              : t.priority === 'medium'
                                ? '#fbbf24'
                                : '#9ca3af',
                        }}
                      >
                        {t.priority}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {activeOutput.notifications.length === 0 &&
            activeOutput.suggestions.length === 0 &&
            activeOutput.tasks.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: `${space[10]}px 0`,
                  color: colors.text.faint,
                  fontSize: fontSize.sm,
                }}
              >
                <div style={{ marginBottom: space[3], display: 'flex', justifyContent: 'center' }}>
                  <Icon name="radar" size={34} color="rgba(246,196,0,0.55)" strokeWidth={1.6} />
                </div>
                <p style={{ margin: 0 }}>
                  {tab === 'scene'
                    ? 'No scene activity detected yet — add gigs and follows to seed the radar.'
                    : 'Scene Orbit needs more graph connections. Add gig history via Tour Weaver.'}
                </p>
              </div>
            )}

          {/* Lua logs (dev-mode only) */}
          {process.env.NODE_ENV === 'development' && activeOutput.lua_logs.length > 0 && (
            <details style={{ marginTop: space[4] }}>
              <summary
                style={{ fontSize: fontSize.xs, color: colors.text.faint, cursor: 'pointer' }}
              >
                Lua logs ({activeOutput.lua_logs.length})
              </summary>
              <pre
                style={{
                  marginTop: space[2],
                  padding: space[3],
                  background: '#111',
                  borderRadius: radius.sm,
                  fontSize: 11,
                  color: '#6b7280',
                  overflow: 'auto',
                  maxHeight: 200,
                }}
              >
                {activeOutput.lua_logs.join('\n')}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Empty state before first run */}
      {!activeLoading && !activeOutput && !activeError && (
        <div style={{ textAlign: 'center', padding: `${space[10]}px 0`, color: colors.text.faint }}>
          <div style={{ marginBottom: space[3], display: 'flex', justifyContent: 'center' }}>
            <Icon name="radar" size={34} color="rgba(246,196,0,0.55)" strokeWidth={1.6} />
          </div>
          <p style={{ fontSize: fontSize.sm, margin: 0 }}>Click refresh to scan your scene.</p>
        </div>
      )}
    </div>
  );
}
