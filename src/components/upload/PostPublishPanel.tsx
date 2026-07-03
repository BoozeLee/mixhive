import { useTranslations } from 'next-intl';
import { Link } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import { colors, fontSize, fontWeight, radius, space, transition } from '../../styles/tokens';

interface PostPublishPanelProps {
  mixId: string;
  mixTitle: string;
}

export function PostPublishPanel({ mixId, mixTitle }: PostPublishPanelProps) {
  const t = useTranslations('upload');
  const shareUrl = `${window.location.origin}/mix/${mixId}`;

  function copyLink() {
    void navigator.clipboard?.writeText(shareUrl);
  }

  return (
    <div
      style={{
        padding: space[7],
        background: `linear-gradient(135deg, ${colors.accentFaint}, rgba(59,130,246,0.1))`,
        border: `1px solid ${colors.accentMuted}`,
        borderRadius: radius.lg,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: radius.full,
          background: colors.accent,
          color: colors.bg,
          display: 'grid',
          placeItems: 'center',
          margin: `0 auto ${space[5]}px`,
        }}
      >
        <Icon name="check" size={28} color="currentColor" />
      </div>
      <h2
        style={{
          fontSize: fontSize.xl,
          fontWeight: fontWeight.bold,
          color: colors.text.primary,
          margin: 0,
        }}
      >
        {t('publishSuccess', { title: mixTitle })}
      </h2>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: space[4],
          marginTop: space[7],
        }}
      >
        <button
          type="button"
          onClick={copyLink}
          style={{
            padding: `${space[4]}px ${space[6]}px`,
            background: colors.surface,
            border: `1px solid ${colors.borderStrong}`,
            borderRadius: radius.md,
            color: colors.text.secondary,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            cursor: 'pointer',
            transition: `border-color ${transition.fast}`,
          }}
        >
          {t('copyLink')}
        </button>
        <Link
          to={`/mix/${mixId}`}
          style={{
            padding: `${space[4]}px ${space[6]}px`,
            background: colors.accent,
            borderRadius: radius.md,
            color: colors.bg,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.bold,
            textDecoration: 'none',
          }}
        >
          View mix
        </Link>
      </div>

      <div style={{ marginTop: space[8], textAlign: 'left' }}>
        <h3
          style={{
            fontSize: fontSize.md,
            fontWeight: fontWeight.semibold,
            color: colors.text.secondary,
            margin: `0 0 ${space[4]}px`,
          }}
        >
          {t('suggestedAgents')}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
          {[
            { name: 'Release Strategy', slug: 'RELEASE_STRATEGY' },
            { name: 'Press Kit', slug: 'PRESS_KIT' },
          ].map(agent => (
            <Link
              key={agent.slug}
              to={`/agents/gallery?category=release`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: space[5],
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                color: colors.text.secondary,
                textDecoration: 'none',
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
                transition: `border-color ${transition.fast}`,
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = colors.accentMuted)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = colors.border)}
            >
              {agent.name}
              <Icon name="external" size={14} color="currentColor" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
