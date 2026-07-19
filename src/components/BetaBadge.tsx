'use client';

import { useTranslations } from 'next-intl';
import { colors, fontSize, radius, withAlpha } from '../styles/tokens';

export function BetaBadge() {
  const t = useTranslations('beta');
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: withAlpha(colors.accentBright, 0.15),
        color: 'var(--hive-gold)',
        fontSize: fontSize.xs,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: radius.full,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {t('badge')}
    </span>
  );
}
