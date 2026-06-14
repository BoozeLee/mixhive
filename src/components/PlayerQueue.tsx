import { usePlayer } from '../lib/playerStore';
import { colors } from '../styles/tokens';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';

export function PlayerQueue() {
  const { queue, queueIndex, removeFromQueue, clearQueue } = usePlayer();

  if (queue.length === 0) return null;

  return (
    <div
      style={{
        background: colors.surface,
        borderTop: `1px solid ${colors.border}`,
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
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <span style={{ fontSize: 12, color: colors.text.muted, fontWeight: 600 }}>
          UP NEXT ({queue.length})
        </span>
        <Button variant="ghost" size="sm" onClick={clearQueue}>
          Clear all
        </Button>
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
              background: isCurrent ? colors.border : 'transparent',
              borderBottom: `1px solid ${colors.bg}`,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 4,
                flexShrink: 0,
                background: `linear-gradient(135deg, ${colors.border}, ${colors.accentFaint})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                color: colors.accentMuted,
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
                  color: isCurrent ? colors.accent : colors.text.secondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {isCurrent && '▶ '}
                {track.title}
              </div>
              <div style={{ fontSize: 11, color: colors.text.faint }}>{track.djName}</div>
            </div>
            <IconButton label="Remove from queue" onClick={() => removeFromQueue(i)} size={24}>
              ✕
            </IconButton>
          </div>
        );
      })}
    </div>
  );
}
