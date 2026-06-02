import { Link } from 'react-router-dom';
import type { Playlist } from '../lib/types';

interface Props {
  playlist: Playlist;
}

export function PlaylistCard({ playlist }: Props) {
  const link = `/playlist/${playlist.id}`;

  return (
    <Link to={link} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        style={{
          display: 'flex',
          gap: 14,
          padding: 14,
          background: '#111',
          borderRadius: 10,
          border: '1px solid #1a1a2e',
          transition: 'border-color 0.2s',
          cursor: 'pointer',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = '#f0c04044')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = '#1a1a2e')}
      >
        <div
          style={{
            width: 70,
            height: 70,
            borderRadius: 8,
            background: playlist.artwork_url
              ? `url(${playlist.artwork_url}) center/cover`
              : 'linear-gradient(135deg, #1a1a2e, #2a1a2e)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            color: '#f0c04044',
          }}
        >
          {!playlist.artwork_url && '♫'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: '#eee',
              marginBottom: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {playlist.title}
          </div>
          {playlist.description && (
            <div
              style={{
                fontSize: 12,
                color: '#666',
                marginBottom: 6,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {playlist.description}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, fontSize: 13, color: '#888' }}>
            <span>
              {playlist.mix_count} {playlist.mix_count === 1 ? 'mix' : 'mixes'}
            </span>
            {!playlist.is_public && <span style={{ color: '#f0c04066' }}>Private</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
