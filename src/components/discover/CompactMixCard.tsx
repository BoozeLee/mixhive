import { Link } from 'react-router-dom';
import { usePlayer } from '../../lib/playerStore';
import { colors, fontSize, fontWeight, radius, space, transition } from '../../styles/tokens';
import { getGenreColor } from '../../styles/tokens';
import type { FeedMix } from '../../lib/types';

interface CompactMixCardProps {
  mix: FeedMix;
}

export function CompactMixCard({ mix }: CompactMixCardProps) {
  const { play, currentTrack } = usePlayer();
  const isNowPlaying = currentTrack?.id === mix.id;
  const genreColor = getGenreColor(mix.genre_name);
  const artworkPlaceholder = `linear-gradient(135deg, ${genreColor}33 0%, ${colors.surface} 100%)`;

  function handlePlay(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    play(
      {
        id: mix.id,
        title: mix.title,
        djName: mix.dj_display_name || mix.dj_username,
        djUsername: mix.dj_username,
        artworkUrl: mix.artwork_url,
        audioUrl: mix.audio_url,
      },
      { clearQueue: true }
    );
  }

  return (
    <Link
      to={`/mix/${mix.id}`}
      style={{
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
        flexShrink: 0,
        width: 160,
        scrollSnapAlign: 'start',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          borderRadius: radius.lg,
          background: mix.artwork_url ? undefined : artworkPlaceholder,
          overflow: 'hidden',
          border: `1px solid ${isNowPlaying ? colors.accentMuted : colors.border}`,
          transition: `border-color ${transition.fast}`,
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = colors.accentMuted)}
        onMouseLeave={e => {
          if (!isNowPlaying) e.currentTarget.style.borderColor = colors.border;
        }}
      >
        {mix.artwork_url ? (
          <img
            src={mix.artwork_url}
            alt={`Artwork for ${mix.title}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div
            aria-hidden="true"
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              color: `${genreColor}66`,
            }}
          >
            ♪
          </div>
        )}

        {/* Play overlay */}
        <button
          onClick={handlePlay}
          aria-label={isNowPlaying ? `Restart ${mix.title}` : `Play ${mix.title}`}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.48)',
            border: 'none',
            color: colors.accent,
            fontSize: 28,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isNowPlaying ? 1 : 0,
            transition: `opacity ${transition.fast}`,
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => {
            if (!isNowPlaying) e.currentTarget.style.opacity = '0';
          }}
        >
          <span aria-hidden="true">▶</span>
        </button>

        {mix.ai_band && (
          <span
            style={{
              position: 'absolute',
              top: space[3],
              left: space[3],
              fontSize: 10,
              fontWeight: fontWeight.semibold,
              padding: '2px 7px',
              borderRadius: radius.pill,
              background: `${colors.accent}22`,
              border: `1px solid ${colors.accentMuted}`,
              color: colors.accent,
            }}
          >
            AI
          </span>
        )}

        {mix.duration_seconds && (
          <span
            style={{
              position: 'absolute',
              bottom: space[3],
              right: space[3],
              fontSize: 10,
              fontWeight: fontWeight.semibold,
              padding: '2px 6px',
              borderRadius: radius.sm,
              background: 'rgba(0,0,0,0.72)',
              color: colors.text.secondary,
            }}
          >
            {Math.floor(mix.duration_seconds / 60)}:
            {(mix.duration_seconds % 60).toString().padStart(2, '0')}
          </span>
        )}
      </div>

      <div style={{ marginTop: space[4], minWidth: 0 }}>
        <div
          style={{
            fontSize: fontSize.md,
            fontWeight: fontWeight.semibold,
            color: isNowPlaying ? colors.accent : colors.text.primary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={mix.title}
        >
          {mix.title}
        </div>
        <div
          style={{
            fontSize: fontSize.sm,
            color: colors.text.muted,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={mix.dj_display_name || mix.dj_username}
        >
          {mix.dj_display_name || mix.dj_username}
        </div>
      </div>
    </Link>
  );
}
