import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getXpLeaderboard, type LeaderboardEntry } from '../lib/api';
import { LevelBadge } from '../components/LevelBadge';
import { EmptyState } from '../components/EmptyState';
import { SkeletonBar } from '../components/Skeleton';
import { colors, radius, space } from '../styles/tokens';

function rankAccent(rank: number): string {
  if (rank === 1) return '#e8c14a';
  if (rank === 2) return '#b8b8c0';
  if (rank === 3) return '#b07a4a';
  return colors.text.faint;
}

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getXpLeaderboard(50)
      .then(rows => {
        if (!cancelled) setEntries(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 12px 96px' }}>
      <header style={{ marginBottom: space[9] }}>
        <h1 style={{ margin: 0, fontSize: 26, color: colors.text.primary }}>Hive Leaderboard</h1>
        <p style={{ color: colors.text.dim, fontSize: 13, margin: '6px 0 0' }}>
          Top builders ranked by XP earned from completed collab quests.
        </p>
      </header>

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
    </div>
  );
}
