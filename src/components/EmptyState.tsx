import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { Icon } from './ui/Icon';
import { GlowText } from './ui/GlowText';
import type { IconKey } from '../lib/icons';
import { colors, space, radius, fontSize, fontWeight } from '../styles/tokens';

interface Props {
  /** Preferred: a registry icon key (renders a professional lucide glyph). */
  iconKey?: IconKey;
  /** Legacy: a raw glyph/emoji string (kept for back-compat). */
  icon?: string;
  title: string;
  body?: ReactNode;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
}

const actionStyle = {
  marginTop: space[9],
  padding: '9px 22px',
  borderRadius: radius.md,
  background: colors.accent,
  color: colors.bg,
  textDecoration: 'none',
  fontWeight: fontWeight.bold,
  fontSize: fontSize.md,
  border: 'none',
  cursor: 'pointer',
} as const;

export function EmptyState({
  iconKey = 'music',
  icon,
  title,
  body,
  actionLabel,
  actionTo,
  onAction,
}: Props) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        color: colors.text.muted,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 84,
          height: 84,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(246,196,0,0.12), rgba(10,9,6,0.9))',
          border: `1px solid ${colors.accentMuted}`,
          boxShadow: '0 12px 32px rgba(0,0,0,0.28), inset 0 0 24px rgba(246,196,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(246,196,0,0.7)',
          fontSize: 32,
          marginBottom: space[8],
        }}
      >
        {icon ? icon : <Icon name={iconKey} size={34} color="currentColor" strokeWidth={1.8} />}
      </div>
      <GlowText
        as="h2"
        variant="plain"
        style={{
          margin: 0,
          fontSize: fontSize.xl,
          fontWeight: fontWeight.bold,
          color: colors.text.primary,
        }}
      >
        {title}
      </GlowText>
      {body && (
        <div
          style={{
            marginTop: space[4],
            maxWidth: 380,
            lineHeight: 1.5,
            color: colors.text.muted,
            fontSize: fontSize.md,
          }}
        >
          {body}
        </div>
      )}
      {actionLabel &&
        (actionTo || onAction) &&
        (actionTo ? (
          <Link to={actionTo} style={actionStyle}>
            {actionLabel}
          </Link>
        ) : (
          <button onClick={onAction} style={actionStyle}>
            {actionLabel}
          </button>
        ))}
    </div>
  );
}

export function NotFoundState({
  what,
  backTo = '/feed',
  backLabel,
}: {
  what?: string;
  backTo?: string;
  backLabel?: string;
}) {
  const t = useTranslations('emptyState');
  return (
    <EmptyState
      iconKey="search"
      title={what ? `${what} ${t('doesNotExist')}` : t('notFound')}
      body={t('notFoundBody')}
      actionLabel={backLabel || t('backToFeed')}
      actionTo={backTo}
    />
  );
}
