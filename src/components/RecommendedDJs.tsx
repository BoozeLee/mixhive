import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRecommendedDJs, follow } from '../lib/api';
import type { RecommendedDJ } from '../lib/types';

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
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#ccc', marginBottom: 10 }}>
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
              background: '#111',
              borderRadius: 8,
              border: '1px solid #1a1a2e',
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
                  : 'linear-gradient(135deg, #1a1a2e, #f0c04022)',
                display: 'block',
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link
                to={`/u/${dj.username}`}
                style={{
                  color: '#eee',
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
                    color: '#666',
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
                background: followed[dj.id] ? '#333' : '#f0c040',
                color: followed[dj.id] ? '#666' : '#0a0a0a',
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
