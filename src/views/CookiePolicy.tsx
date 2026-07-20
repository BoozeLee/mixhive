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
const th = {
  fontSize: fontSize.xs,
  fontWeight: 600,
  color: colors.text.primary,
  textAlign: 'left' as const,
  padding: '8px 12px',
  borderBottom: `1px solid ${colors.border}`,
};
const td = {
  fontSize: fontSize.xs,
  color: colors.text.secondary,
  padding: '8px 12px',
  borderBottom: `1px solid ${colors.border}`,
};

export function CookiePolicy() {
  const t = useTranslations('cookies');

  const rows = [
    {
      name: t('mhLocaleName'),
      provider: t('mhLocaleProvider'),
      purpose: t('mhLocalePurpose'),
      duration: t('mhLocaleDuration'),
      type: t('functionalType'),
    },
    {
      name: t('supabaseAuthName'),
      provider: t('supabaseAuthProvider'),
      purpose: t('supabaseAuthPurpose'),
      duration: t('supabaseAuthDuration'),
      type: t('necessaryType'),
    },
    {
      name: t('consentRecordName'),
      provider: t('consentRecordProvider'),
      purpose: t('consentRecordPurpose'),
      duration: t('consentRecordDuration'),
      type: t('functionalType'),
    },
    {
      name: t('vercelAnalyticsName'),
      provider: t('vercelAnalyticsProvider'),
      purpose: t('vercelAnalyticsPurpose'),
      duration: t('vercelAnalyticsDuration'),
      type: t('analyticsType'),
    },
  ];

  return (
    <div style={wrap}>
      <h1 style={h1}>{t('title')}</h1>
      <p style={{ ...p, color: colors.text.dim }}>{t('lastUpdated')}</p>

      <h2 style={h2}>{t('necessaryHeading')}</h2>
      <p style={p}>{t('necessaryBody')}</p>

      <h2 style={h2}>{t('analyticsHeading')}</h2>
      <p style={p}>{t('analyticsBody')}</p>

      <h2 style={h2}>{t('marketingHeading')}</h2>
      <p style={p}>{t('marketingBody')}</p>

      <h2 style={h2}>{t('declarationHeading')}</h2>
      <p style={p}>{t('declarationBody')}</p>
      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>{t('cookieName')}</th>
              <th style={th}>{t('cookieProvider')}</th>
              <th style={th}>{t('cookiePurpose')}</th>
              <th style={th}>{t('cookieDuration')}</th>
              <th style={th}>{t('cookieType')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.name}>
                <td style={td}>{row.name}</td>
                <td style={td}>{row.provider}</td>
                <td style={td}>{row.purpose}</td>
                <td style={td}>{row.duration}</td>
                <td style={td}>{row.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={h2}>{t('thirdPartyHeading')}</h2>
      <p style={p}>{t('thirdPartyBody')}</p>

      <h2 style={h2}>{t('managingHeading')}</h2>
      <p style={p}>{t('managingBody')}</p>

      <h2 style={h2}>{t('browserHeading')}</h2>
      <p style={p}>{t('browserBody')}</p>
    </div>
  );
}
