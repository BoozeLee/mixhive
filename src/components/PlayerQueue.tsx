import { usePlayer } from '../lib/playerStore';

export function PlayerQueue() {
  const { queue, queueIndex, removeFromQueue, clearQueue } = usePlayer();

  if (queue.length === 0) return null;

  return (
    <div
      style={{
        background: '#111',
        borderTop: '1px solid #1a1a2e',
        maxHeight: 240,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          borderBottom: '1px solid #1a1a2e',
        }}
      >
        <span style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>
          UP NEXT ({queue.length})
        </span>
        <button
          onClick={clearQueue}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#555',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Clear all
        </button>
      </div>
      {queue.map((track, i) => {
        const isCurrent = i === queueIndex;
        return (
          <div
            key={track.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 16px',
              background: isCurrent ? '#1a1a2e' : 'transparent',
              borderBottom: '1px solid #0a0a0a',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 4,
                flexShrink: 0,
                background: 'linear-gradient(135deg, #1a1a2e, #f0c04022)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                color: '#f0c04044',
                overflow: 'hidden',
              }}
            >
              {track.artworkUrl ? (
                <img
                  src={track.artworkUrl}
                  alt={`Artwork for ${track.title}`}
                  width={32}
                  height={32}
                  loading="lazy"
                  decoding="async"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span aria-hidden="true">♪</span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: isCurrent ? '#f0c040' : '#ccc',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {isCurrent && '▶ '}
                {track.title}
              </div>
              <div style={{ fontSize: 11, color: '#666' }}>{track.djName}</div>
            </div>
            <button
              onClick={() => removeFromQueue(i)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#555',
                fontSize: 14,
                cursor: 'pointer',
                padding: 2,
              }}
              title="Remove"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
