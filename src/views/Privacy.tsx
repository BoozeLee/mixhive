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

      <h2 style={h2}>{t('retentionHeading')}</h2>
      <p style={p}>{t('retentionBody')}</p>

      <h2 style={h2}>{t('transfersHeading')}</h2>
      <p style={p}>{t('transfersBody')}</p>

      <h2 style={h2}>{t('thirdPartiesHeading')}</h2>
      <p style={p}>{t('thirdPartiesBody')}</p>

      <h2 style={h2}>{t('rightsHeading')}</h2>
      <p style={p}>{t('rightsBody')}</p>

      <h2 style={h2}>{t('supervisoryHeading')}</h2>
      <p style={p}>{t('supervisoryBody')}</p>

      <h2 style={h2}>{t('automatedHeading')}</h2>
      <p style={p}>{t('automatedBody')}</p>

      <h2 style={h2}>{t('contactHeading')}</h2>
      <p style={p}>{t('contactBody')}</p>
    </div>
  );
}
