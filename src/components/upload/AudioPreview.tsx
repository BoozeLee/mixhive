import { useEffect, useRef, useState } from 'react';
import { colors, fontSize, fontWeight, radius, space } from '../../styles/tokens';
import { Icon } from '../ui/Icon';

interface AudioPreviewProps {
  file: File;
}

export function AudioPreview({ file }: AudioPreviewProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [url, setUrl] = useState<string>('');

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function updateTime() {
      setCurrentTime(audio.currentTime);
    }
    function handleLoaded() {
      setDuration(audio.duration);
    }
    function handleEnded() {
      setIsPlaying(false);
    }

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', handleLoaded);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', handleLoaded);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [url]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      void audio.play();
    }
    setIsPlaying(!isPlaying);
  }

  function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space[5],
        padding: space[5],
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.lg,
      }}
    >
      <audio ref={audioRef} src={url} preload="metadata" />
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
        style={{
          width: 44,
          height: 44,
          borderRadius: radius.full,
          border: 'none',
          background: colors.accent,
          color: colors.bg,
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Icon name={isPlaying ? 'square' : 'play'} size={18} color="currentColor" />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            color: colors.text.primary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {file.name}
        </div>
        <div style={{ fontSize: fontSize.xs, color: colors.text.dim, marginTop: space[1] }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    </div>
  );
}
