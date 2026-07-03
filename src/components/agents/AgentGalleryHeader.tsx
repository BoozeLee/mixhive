import { useTranslations } from 'next-intl';
import { Link } from 'react-router-dom';
import { colors, fontSize, fontWeight, radius, space } from '../../styles/tokens';

export function AgentGalleryHeader() {
  const t = useTranslations('agentsGallery');

  return (
    <div
      style={{
        marginBottom: space[10],
        padding: `${space[8]}px ${space[7]}px`,
        background: `linear-gradient(135deg, ${colors.accentFaint}, rgba(59,130,246,0.08))`,
        border: `1px solid ${colors.accentMuted}`,
        borderRadius: radius.xl,
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: fontSize['3xl'],
          fontWeight: fontWeight.bold,
          color: colors.text.primary,
        }}
      >
        {t('heroTitle')}
      </h1>
      <p
        style={{
          margin: `${space[3]}px 0 0`,
          color: colors.text.muted,
          fontSize: fontSize.md,
          maxWidth: 640,
          lineHeight: 1.5,
        }}
      >
        {t('heroBody')}
      </p>
      <div style={{ marginTop: space[6] }}>
        <Link
          to="/agents"
          style={{
            color: colors.accent,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            textDecoration: 'none',
          }}
        >
          {t('backToMyAgents')}
        </Link>
      </div>
    </div>
  );
}
