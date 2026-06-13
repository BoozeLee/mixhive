import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRecommendedDJs, follow } from '../lib/api';
import type { RecommendedDJ } from '../lib/types';
import { colors } from '../styles/tokens';

interface Props {
  userId: string;
}

export function RecommendedDJs({ userId }: Props) {
  const [djs, setDjs] = useState<RecommendedDJ[]>([]);
  const [followed, setFollowed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getRecommendedDJs(userId).then(setDjs);
  }, [userId]);

  if (djs.length === 0) return null;

  async function handleFollow(djId: string) {
    await follow(userId, djId);
    setFollowed(prev => ({ ...prev, [djId]: true }));
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: colors.text.secondary, marginBottom: 10 }}>
        Recommended DJs
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {djs.map(dj => (
          <div
            key={dj.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              background: colors.surface,
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
            }}
          >
            <Link
              to={`/u/${dj.username}`}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                flexShrink: 0,
                background: dj.avatar_url
                  ? `url(${dj.avatar_url}) center/cover`
                  : `linear-gradient(135deg, ${colors.border}, ${colors.accentFaint})`,
                display: 'block',
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link
                to={`/u/${dj.username}`}
                style={{
                  color: colors.text.primary,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {dj.display_name || dj.username}
              </Link>
              {dj.recent_mix_title && (
                <div
                  style={{
                    fontSize: 11,
                    color: colors.text.faint,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Latest: {dj.recent_mix_title}
                </div>
              )}
            </div>
            <button
              onClick={() => handleFollow(dj.id)}
              disabled={followed[dj.id]}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: 'none',
                background: followed[dj.id] ? colors.borderStrong : colors.accent,
                color: followed[dj.id] ? colors.text.faint : colors.bg,
                fontWeight: 600,
                fontSize: 12,
                cursor: followed[dj.id] ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {followed[dj.id] ? '✓ Followed' : 'Follow'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
