import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getXpLeaderboard, type LeaderboardEntry, getAIAgentLeaderboard, type AIAgent } from '../lib/api';
import { LevelBadge } from '../components/LevelBadge';
import { EmptyState } from '../components/EmptyState';
import { SkeletonBar } from '../components/Skeleton';
import { colors, fontSize, fontWeight, radius, space } from '../styles/tokens';

function rankAccent(rank: number): string {
  if (rank === 1) return '#e8c14a';
  if (rank === 2) return '#b8b8c0';
  if (rank === 3) return '#b07a4a';
  return colors.text.faint;
}

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getXpLeaderboard(50), getAIAgentLeaderboard(10)])
      .then(([rows, ags]) => {
        if (!cancelled) { setEntries(rows); setAgents(ags); }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 12px 96px' }}>
      <header style={{ marginBottom: space[9] }}>
        <h1 style={{ margin: 0, fontSize: 26, color: colors.text.primary }}>Hive Leaderboard</h1>
        <p style={{ color: colors.text.dim, fontSize: 13, margin: '6px 0 0' }}>
          Top builders ranked by XP earned from completed collab quests.
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: space[8],
          alignItems: 'start',
        }}
      >
        {/* Artist XP ranking */}
        <section>
          <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: colors.text.secondary }}>
            ⭐ Artist XP
          </h2>
          {loading ? (
            <div style={{ display: 'grid', gap: space[5] }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonBar key={i} height={56} />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <EmptyState
              icon="◆"
              title="No ranks yet"
              body="Complete collab quests to earn XP and climb the Hive leaderboard."
              actionLabel="Browse quests"
              actionTo="/collab-quests"
            />
          ) : (
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: space[5] }}>
              {entries.map((entry, index) => {
                const rank = index + 1;
                const name = entry.display_name || entry.username;
                return (
                  <li key={entry.id}>
                    <Link
                      to={`/u/${entry.username}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: space[6],
                        padding: space[6],
                        background: colors.surface,
                        border: `1px solid ${rank <= 3 ? colors.accentMuted : colors.border}`,
                        borderRadius: radius.lg,
                        textDecoration: 'none',
                      }}
                    >
                      <span
                        style={{
                          width: 28,
                          textAlign: 'center',
                          flexShrink: 0,
                          fontWeight: 900,
                          fontSize: 16,
                          color: rankAccent(rank),
                        }}
                      >
                        {rank}
                      </span>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          flexShrink: 0,
                          background: entry.avatar_url
                            ? `url(${entry.avatar_url}) center/cover`
                            : colors.surfaceHover,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            color: colors.text.primary,
                            fontWeight: 700,
                            fontSize: 14,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {name}
                        </div>
                        <div style={{ color: colors.text.dim, fontSize: 12 }}>
                          {entry.xp.toLocaleString()} XP
                          {entry.xp > 0 && ` · ★ ${Number(entry.reputation_score).toFixed(1)}`}
                        </div>
                      </div>
                      <LevelBadge level={entry.level} size={40} />
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* AI Band ranking */}
        <section>
          <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: colors.text.secondary }}>
            🤖 AI Band
          </h2>
          {loading ? (
            <div style={{ display: 'grid', gap: space[5] }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonBar key={i} height={56} />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.lg,
                padding: space[8],
                textAlign: 'center',
                color: colors.text.muted,
                fontSize: fontSize.sm,
              }}
            >
              No AI agents yet.
            </div>
          ) : (
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: space[5] }}>
              {agents.map((agent, index) => {
                const rank = index + 1;
                return (
                  <li key={agent.id}>
                    <Link
                      to={`/ai-band/${agent.slug}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: space[6],
                        padding: space[6],
                        background: colors.surface,
                        border: `1px solid ${rank <= 3 ? colors.accentMuted : colors.border}`,
                        borderRadius: radius.lg,
                        textDecoration: 'none',
                      }}
                    >
                      <span
                        style={{
                          width: 28,
                          textAlign: 'center',
                          flexShrink: 0,
                          fontWeight: 900,
                          fontSize: 16,
                          color: rankAccent(rank),
                        }}
                      >
                        {rank}
                      </span>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          flexShrink: 0,
                          overflow: 'hidden',
                          background: agent.avatar_url ? undefined : `${colors.accentMuted}44`,
                        }}
                      >
                        {agent.avatar_url ? (
                          <img
                            src={agent.avatar_url}
                            alt={agent.name}
                            width={40}
                            height={40}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 18,
                            }}
                          >
                            🤖
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            color: colors.text.primary,
                            fontWeight: fontWeight.semibold,
                            fontSize: 14,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {agent.name}
                        </div>
                        <div style={{ color: colors.text.dim, fontSize: 12 }}>
                          @{agent.slug} · {agent.mixes_credited} mixes
                        </div>
                      </div>
                      <div style={{ fontSize: fontSize.sm, color: colors.text.secondary, flexShrink: 0 }}>
                        {agent.followers_count} followers
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
