import { useParams } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { getMix } from '../lib/api';
import type { Mix } from '../lib/types';
import { colors } from '../styles/tokens';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

export function EmbedMix() {
  const t = useTranslations('embedMix');
  const { id } = useParams<{ id: string }>();
  const [mix, setMix] = useState<Mix | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    getMix(id)
      .then(setMix)
      .catch(() => setError(true));
  }, [id]);

  if (error) {
    return (
      <div
        role="alert"
        style={{
          background: colors.bg,
          color: colors.text.muted,
          padding: 20,
          textAlign: 'center',
          fontFamily: 'sans-serif',
          fontSize: 13,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <span style={{ color: colors.accent, fontSize: 18, marginBottom: 4 }} aria-hidden="true">
          ♪
        </span>
        {t('thisMixIsUnavailable')}
      </div>
    );
  }

  if (!mix) {
    return (
      <div
        style={{
          background: colors.bg,
          color: colors.borderStrong,
          padding: 20,
          textAlign: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const audioUrl = mix.audio_url;

  return (
    <div
      style={{
        background: colors.bg,
        color: colors.text.primary,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 8,
          background: mix.artwork_url
            ? `url(${mix.artwork_url}) center/cover`
            : `linear-gradient(135deg, ${colors.border}, ${colors.accentFaint})`,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          color: colors.accentMuted,
        }}
      >
        {!mix.artwork_url && '♪'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {mix.title}
        </div>
        <div style={{ fontSize: 12, color: colors.text.muted }}>
          {mix.dj?.display_name || mix.dj?.username}
        </div>
      </div>

      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- Embeds expose DJ music playback; captions are not meaningful for instrumental sets. */}
      <audio controls preload="none" style={{ height: 36, maxWidth: 200 }}>
        <source src={audioUrl} />
      </audio>
    </div>
  );
}
