'use client';

import { useTranslations } from 'next-intl';
import { colors, fontSize } from '../styles/tokens';

const wrap = {
  maxWidth: 760,
  margin: '0 auto',
  padding: 24,
  color: colors.text.secondary,
} as const;
const h1 = { fontSize: fontSize['3xl'], fontWeight: 700, color: colors.text.primary } as const;
const h2 = {
  fontSize: fontSize.lg,
  fontWeight: 600,
  color: colors.text.primary,
  marginTop: 24,
} as const;
const p = { fontSize: fontSize.sm, lineHeight: 1.6, marginTop: 8 } as const;

export function Privacy() {
  const t = useTranslations('privacy');

  return (
    <div style={wrap}>
      <h1 style={h1}>{t('title')}</h1>
      <p style={{ ...p, color: colors.text.dim }}>{t('lastUpdated')}</p>

      <h2 style={h2}>{t('whoWeAreHeading')}</h2>
      <p style={p}>{t('whoWeAreBody')}</p>

      <h2 style={h2}>{t('dataHeading')}</h2>
      <p style={p}>{t('dataBody')}</p>

      <h2 style={h2}>{t('legalHeading')}</h2>
      <p style={p}>{t('legalBody')}</p>

      <h2 style={h2}>{t('rightsHeading')}</h2>
      <p style={p}>{t('rightsBody')}</p>

      <h2 style={h2}>{t('contactHeading')}</h2>
      <p style={p}>{t('contactBody')}</p>
    </div>
  );
}
