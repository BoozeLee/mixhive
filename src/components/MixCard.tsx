import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePlayer } from '../lib/playerStore';
import { repost, unrepost, hasReposted } from '../lib/api';
import { LikeButton } from './LikeButton';
import { ShareButton } from './ShareButton';
import { AiBandBadge } from './AiBandBadge';
import { Icon } from './ui/Icon';
import type { FeedMix } from '../lib/types';
import {
  colors,
  fontSize,
  fontWeight,
  getGenreColor,
  radius,
  space,
  transition,
} from '../styles/tokens';

interface Props {
  mix: FeedMix;
}

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (!Number.isFinite(diff) || diff < 0) return '';
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 2592000)}mo`;
}

export function MixCard({ mix }: Props) {
  const { user } = useAuth();
  const { play, addToQueue, currentTrack } = usePlayer();
  const [reposted, setReposted] = useState(false);
  const [repostBusy, setRepostBusy] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const isNowPlaying = currentTrack?.id === mix.id;
  const genreColor = getGenreColor(mix.genre_name);
  const artworkPlaceholder = `linear-gradient(135deg, ${genreColor}33 0%, ${colors.surface} 100%)`;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    hasReposted(user.id, mix.id).then(r => {
      if (!cancelled) setReposted(r);
    });
    return () => {
      cancelled = true;
    };
  }, [user, mix.id]);

  async function handleRepost(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user || repostBusy) return;
    setRepostBusy(true);
    const prev = reposted;
    setReposted(!prev);
    try {
      if (prev) await unrepost(mix.id);
      else await repost(user.id, mix.id, mix.dj_id);
    } catch {
      setReposted(prev);
    } finally {
      setRepostBusy(false);
    }
  }

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

  function handlePlayNext(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    addToQueue({
      id: mix.id,
      title: mix.title,
      djName: mix.dj_display_name || mix.dj_username,
      djUsername: mix.dj_username,
      artworkUrl: mix.artwork_url,
      audioUrl: mix.audio_url,
    });
    setShowMenu(false);
  }

  function handleAddToQueue(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    addToQueue({
      id: mix.id,
      title: mix.title,
      djName: mix.dj_display_name || mix.dj_username,
      djUsername: mix.dj_username,
      artworkUrl: mix.artwork_url,
      audioUrl: mix.audio_url,
    });
    setShowMenu(false);
  }

  const dateLabel = timeAgo(mix.created_at);

  return (
    <div style={{ position: 'relative' }}>
      {/* Repost attribution */}
      {mix.is_repost && mix.reposted_by_username && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 14px 6px',
            fontSize: 11,
            color: colors.text.dim,
          }}
        >
          <span
            style={{ color: colors.success, lineHeight: 0, display: 'inline-flex' }}
            aria-hidden="true"
          >
            <Icon name="repost" size={12} color="currentColor" />
          </span>
          <span>
            Reposted by{' '}
            <Link
              to={`/u/${mix.reposted_by_username}`}
              onClick={e => e.stopPropagation()}
              style={{
                color: colors.text.muted,
                textDecoration: 'none',
                fontWeight: fontWeight.semibold,
              }}
            >
              @{mix.reposted_by_username}
            </Link>
          </span>
        </div>
      )}

      <Link to={`/mix/${mix.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div
          style={{
            display: 'flex',
            gap: space[6],
            padding: space[6],
            background: colors.surface,
            borderRadius: radius.lg,
            border: `1px solid ${isNowPlaying ? colors.accentMuted : colors.border}`,
            transition: `border-color ${transition.fast}`,
            cursor: 'pointer',
            flexDirection: 'column',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = colors.accentMuted)}
          onMouseLeave={e => {
            if (!isNowPlaying) e.currentTarget.style.borderColor = colors.border;
          }}
        >
          {/* Top row: artwork + metadata + actions */}
          <div style={{ display: 'flex', gap: space[6] }}>
            {/* Artwork + play overlay */}
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: radius.md,
                background: mix.artwork_url ? undefined : artworkPlaceholder,
                flexShrink: 0,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {mix.artwork_url && (
                <img
                  src={mix.artwork_url}
                  alt={`Artwork for ${mix.title}`}
                  width={72}
                  height={72}
                  loading="lazy"
                  decoding="async"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              )}
              {!mix.artwork_url && (
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    color: `${genreColor}66`,
                  }}
                >
                  ♪
                </div>
              )}
              {/* Play button */}
              <button
                onClick={handlePlay}
                className="mix-card-play"
                aria-label={isNowPlaying ? `Restart ${mix.title}` : `Play ${mix.title}`}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: radius.md,
                  background: 'rgba(0,0,0,0.52)',
                  border: 'none',
                  color: colors.accent,
                  fontSize: 20,
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
                <span aria-hidden="true">{isNowPlaying ? '▶' : '▶'}</span>
              </button>

              {/* Now playing indicator */}
              {isNowPlaying && (
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    bottom: 3,
                    left: 0,
                    right: 0,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    gap: 2,
                    height: 14,
                  }}
                >
                  {[4, 7, 5, 8, 4].map((h, i) => (
                    <div
                      key={i}
                      style={{
                        width: 3,
                        height: h,
                        background: colors.accent,
                        borderRadius: 2,
                        animation: `eq-bar ${0.6 + i * 0.1}s ease-in-out infinite alternate`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Metadata */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              {/* Title row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 3 }}>
                <div
                  style={{
                    fontSize: fontSize.md,
                    fontWeight: fontWeight.semibold,
                    color: isNowPlaying ? colors.accent : colors.text.primary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {mix.title}
                </div>
                {dateLabel && (
                  <span
                    style={{ fontSize: 11, color: colors.text.faint, flexShrink: 0, marginTop: 2 }}
                  >
                    {dateLabel}
                  </span>
                )}
              </div>

              {/* DJ name */}
              <div style={{ fontSize: fontSize.sm, color: colors.text.muted, marginBottom: 5 }}>
                {mix.dj_display_name || mix.dj_username}
              </div>

              {/* Stats + genre chip row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {mix.published_from === 'beehive' && (
                  <span
                    title="Published directly from Beehive Studio"
                    style={{
                      fontSize: 10,
                      fontWeight: fontWeight.bold,
                      padding: '2px 7px',
                      borderRadius: radius.pill,
                      background: colors.accent,
                      color: colors.black,
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Icon name="zap" size={10} /> BEEHIVE
                  </span>
                )}
                {mix.ai_band && <AiBandBadge />}
                {mix.genre_name && (
                  <span
                    title={mix.genre_name}
                    style={{
                      fontSize: 10,
                      fontWeight: fontWeight.semibold,
                      padding: '2px 7px',
                      borderRadius: radius.pill,
                      background: `${genreColor}22`,
                      border: `1px solid ${genreColor}44`,
                      color: genreColor,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {mix.genre_name}
                  </span>
                )}
                {(mix.play_count ?? 0) > 0 && (
                  <span style={{ fontSize: 11, color: colors.text.dim }}>
                    {mix.play_count} plays
                  </span>
                )}
                {(mix.like_count ?? 0) > 0 && (
                  <span style={{ fontSize: 11, color: colors.text.dim }}>
                    {mix.like_count} likes
                  </span>
                )}
                {mix.duration_seconds && (
                  <span style={{ fontSize: 11, color: colors.text.dim }}>
                    {Math.floor(mix.duration_seconds / 60)}:
                    {(mix.duration_seconds % 60).toString().padStart(2, '0')}
                  </span>
                )}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: fontWeight.semibold,
                    background: colors.border,
                    color: colors.text.dim,
                    padding: '1px 5px',
                    borderRadius: radius.sm,
                  }}
                >
                  {mix.audio_quality === 'original' ? 'HQ' : mix.audio_quality || 'MP3'}
                </span>
              </div>
            </div>

            {/* Action column */}
            {user && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 4,
                  paddingLeft: 4,
                  position: 'relative',
                  flexShrink: 0,
                }}
              >
                <LikeButton mix={mix} userId={user.id} variant="icon" showCount={true} />
                <button
                  onClick={handleRepost}
                  disabled={repostBusy}
                  aria-label={reposted ? `Un-repost ${mix.title}` : `Repost ${mix.title}`}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: reposted ? colors.success : colors.text.faint,
                    cursor: repostBusy ? 'wait' : 'pointer',
                    padding: '4px',
                    lineHeight: 0,
                    opacity: repostBusy ? 0.6 : 1,
                    minWidth: 32,
                    minHeight: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: transition.fast,
                  }}
                >
                  <Icon name="repost" size={16} color="currentColor" />
                </button>
                <ShareButton mix={mix} variant="icon" onShare={() => {}} />
                <button
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowMenu(s => !s);
                  }}
                  aria-label="More options"
                  aria-expanded={showMenu}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: showMenu ? colors.accent : colors.text.faint,
                    cursor: 'pointer',
                    fontSize: 16,
                    padding: '4px',
                    lineHeight: 1,
                    minWidth: 32,
                    minHeight: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ⋯
                </button>
                {showMenu && (
                  <div
                    role="menu"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      zIndex: 10,
                      background: colors.surface,
                      border: `1px solid ${colors.border}`,
                      borderRadius: radius.md,
                      minWidth: 128,
                      padding: 4,
                      boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                    }}
                  >
                    {[
                      { label: 'Play next', handler: handlePlayNext },
                      { label: 'Add to queue', handler: handleAddToQueue },
                    ].map(({ label, handler }) => (
                      <button
                        key={label}
                        role="menuitem"
                        onClick={handler}
                        style={{
                          display: 'block',
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          color: colors.text.primary,
                          padding: `${space[4]}px ${space[5]}px`,
                          fontSize: fontSize.sm,
                          cursor: 'pointer',
                          textAlign: 'left',
                          borderRadius: radius.sm,
                          transition: transition.fast,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = colors.border)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Waveform row — shown when the mix has audio */}
          {mix.audio_url && (
            <div
              aria-hidden="true"
              className="waveform-gold"
              style={{ height: 28, borderRadius: 3, opacity: isNowPlaying ? 1 : 0.55 }}
            />
          )}
        </div>
      </Link>
    </div>
  );
}
