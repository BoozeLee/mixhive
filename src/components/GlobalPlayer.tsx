import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { colors, withAlpha } from '../styles/tokens';
import { usePlayer } from '../lib/playerStore';
import { PlayerQueue } from './PlayerQueue';
import { IconButton } from './ui/IconButton';

export function GlobalPlayer() {
  const t = useTranslations('globalPlayer');
  const {
    currentTrack,
    playing,
    togglePlay,
    stop,
    currentTime,
    duration,
    seek,
    playNext,
    playPrevious,
    volume,
    muted,
    setVolume,
    toggleMute,
    miniMode,
    toggleMini,
    queue,
  } = usePlayer();
  const [showQueue, setShowQueue] = useState(false);

  if (!currentTrack) return null;

  function handleSeek(e: React.MouseEvent<HTMLElement>) {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    seek(pct * duration);
  }

  function handleSeekKey(e: React.KeyboardEvent<HTMLElement>) {
    if (!duration) return;
    const stepSmall = 5;
    const stepLarge = 30;
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = Math.min(duration, currentTime + stepSmall);
    else if (e.key === 'ArrowLeft') next = Math.max(0, currentTime - stepSmall);
    else if (e.key === 'PageUp') next = Math.min(duration, currentTime + stepLarge);
    else if (e.key === 'PageDown') next = Math.max(0, currentTime - stepLarge);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = duration;
    if (next !== null) {
      e.preventDefault();
      seek(next);
    }
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  const hasQueue = queue.length > 0;

  // Mini mode
  if (miniMode) {
    return (
      <div
        className="global-player global-player--mini"
        style={{
          position: 'fixed',
          bottom: 'var(--mixhive-player-bottom, 0px)',
          left: 0,
          right: 0,
          background: colors.surfaceMuted,
          borderTop: `1px solid ${colors.surfaceHover}`,
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 200,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 4,
            flexShrink: 0,
            background: currentTrack.artworkUrl
              ? `url(${currentTrack.artworkUrl}) center/cover`
              : `linear-gradient(135deg, ${colors.surfaceHover}, ${colors.accentFaint})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: colors.accentMuted,
          }}
        >
          {!currentTrack.artworkUrl && '♪'}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: colors.text.primary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {currentTrack.title}
          </div>
        </div>
        <IconButton
          label={playing ? t('pause') : t('play')}
          onClick={togglePlay}
          size={28}
          style={{
            background: colors.accent,
            color: colors.bg,
            borderRadius: '50%',
            flexShrink: 0,
          }}
        >
          {playing ? '⏸' : '▶'}
        </IconButton>
        <IconButton label={t('expand')} onClick={toggleMini} size={24}>
          ▲
        </IconButton>
      </div>
    );
  }

  return (
    <>
      {showQueue && <PlayerQueue />}
      <div
        className="global-player global-player--full"
        style={{
          position: 'fixed',
          bottom: 'var(--mixhive-player-bottom, 0px)',
          left: 0,
          right: 0,
          background: colors.surfaceMuted,
          borderTop: `1px solid ${colors.surfaceHover}`,
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          zIndex: 200,
        }}
      >
        {/* Artwork */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 6,
            flexShrink: 0,
            background: currentTrack.artworkUrl
              ? `url(${currentTrack.artworkUrl}) center/cover`
              : `linear-gradient(135deg, ${colors.surfaceHover}, ${colors.accentFaint})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            color: colors.accentMuted,
          }}
        >
          {!currentTrack.artworkUrl && '♪'}
        </div>

        {/* Track info */}
        <div style={{ minWidth: 0, width: 160, flexShrink: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: colors.text.primary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {currentTrack.title}
          </div>
          <div style={{ fontSize: 11, color: colors.text.muted }}>{currentTrack.djName}</div>
        </div>

        {/* Prev / Play-Pause / Next */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <IconButton label={t('previous')} onClick={playPrevious} size={28}>
            ⏮
          </IconButton>
          <IconButton
            label={playing ? t('pause') : t('play')}
            onClick={togglePlay}
            size={34}
            style={{
              background: colors.accent,
              color: colors.bg,
              borderRadius: '50%',
              flexShrink: 0,
            }}
          >
            {playing ? '⏸' : '▶'}
          </IconButton>
          <IconButton label={t('next')} onClick={playNext} size={28}>
            ⏭
          </IconButton>
        </div>

        {/* Progress bar */}
        <div style={{ flex: 1, minWidth: 80 }}>
          <div
            role="slider"
            aria-label={t('seek')}
            aria-valuemin={0}
            aria-valuemax={Math.max(0, Math.floor(duration))}
            aria-valuenow={Math.floor(currentTime)}
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
            tabIndex={0}
            onClick={handleSeek}
            onKeyDown={handleSeekKey}
            style={{
              height: 3,
              background: colors.borderSubtle,
              borderRadius: 4,
              cursor: 'pointer',
              position: 'relative',
              outline: 'none',
            }}
            onFocus={e => {
              e.currentTarget.style.boxShadow = `0 0 0 2px ${withAlpha(colors.accent, 0.33)}`;
            }}
            onBlur={e => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div
              style={{
                height: '100%',
                width: duration ? `${(currentTime / duration) * 100}%` : '0%',
                background: colors.accent,
                borderRadius: 4,
                transition: 'width 0.1s linear',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              color: colors.text.faintest,
              marginTop: 2,
            }}
          >
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <IconButton
            label={muted ? t('unmute') : t('mute')}
            onClick={toggleMute}
            size={28}
            style={muted ? { color: colors.danger } : undefined}
          >
            {muted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
          </IconButton>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={e => setVolume(parseFloat(e.target.value))}
            style={{ width: 60, height: 3, accentColor: colors.accent }}
            title={t('volume')}
          />
        </div>

        {/* Queue toggle */}
        {hasQueue && (
          <IconButton
            label={t('queue')}
            active={showQueue}
            onClick={() => setShowQueue(s => !s)}
            size={28}
          >
            ☰
          </IconButton>
        )}

        {/* Mini mode */}
        <IconButton label={t('minimize')} onClick={toggleMini} size={24}>
          ▼
        </IconButton>

        {/* Close */}
        <IconButton label={t('close')} onClick={stop} size={24}>
          ✕
        </IconButton>
      </div>
    </>
  );
}
