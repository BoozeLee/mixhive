'use client';
import { useTranslations } from 'next-intl';

import { useState, useEffect } from 'react';
import { colors, fontSize, radius } from '../styles/tokens';
import { consentDecided, saveConsent } from '../lib/consent';

export function ConsentBanner() {
  const t = useTranslations('consentBanner');
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<'simple' | 'preferences'>('simple');
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    setShow(!consentDecided());
  }, []);

  if (!show) return null;

  const decide = async (a: boolean, m: boolean = false) => {
    await saveConsent({ analytics: a, marketing: m });
    setShow(false);
  };

  const btn = (bg: string, fg: string) => ({
    padding: '8px 14px',
    fontSize: fontSize.sm,
    fontWeight: 600,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    background: bg,
    color: fg,
    cursor: 'pointer',
  });

  return (
    <div
      role="dialog"
      aria-label={t('cookieConsent')}
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 2000,
        maxWidth: 720,
        margin: '0 auto',
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.lg,
        padding: 16,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }}
    >
      {mode === 'simple' ? (
        <>
          <p style={{ color: colors.text.secondary, fontSize: fontSize.sm, margin: 0 }}>
            {t.rich('description', {
              cookieLink: (chunks) => (
                <a href="/cookies" style={{ color: colors.text.primary, textDecoration: 'underline' }}>
                  {chunks}
                </a>
              ),
              privacyLink: (chunks) => (
                <a href="/privacy" style={{ color: colors.text.primary, textDecoration: 'underline' }}>
                  {chunks}
                </a>
              ),
            })}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button onClick={() => decide(true)} style={btn(colors.success, colors.black)}>
              {t('acceptAnalytics')}
            </button>
            <button onClick={() => decide(false)} style={btn('transparent', colors.text.secondary)}>
              {t('rejectNonEssential')}
            </button>
            <button onClick={() => setMode('preferences')} style={btn('transparent', colors.text.secondary)}>
              {t('managePreferences')}
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ color: colors.text.secondary, fontSize: fontSize.sm, margin: '0 0 12px' }}>
            {t('managePreferences')}
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: fontSize.sm, color: colors.text.primary, marginBottom: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} />
            <div style={{ fontWeight: 600 }}>{t('analyticsLabel')}</div>
          </label>
          <div style={{ fontSize: fontSize.xs, color: colors.text.dim, marginTop: -4, marginBottom: 8, paddingLeft: 30 }}>{t('analyticsHelp')}</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: fontSize.sm, color: colors.text.primary, marginBottom: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
            <div style={{ fontWeight: 600 }}>{t('marketingLabel')}</div>
          </label>
          <div style={{ fontSize: fontSize.xs, color: colors.text.dim, marginTop: -4, marginBottom: 12, paddingLeft: 30 }}>{t('marketingHelp')}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => decide(analytics, marketing)} style={btn(colors.success, colors.black)}>
              {t('savePreferences')}
            </button>
            <button onClick={() => setMode('simple')} style={btn('transparent', colors.text.secondary)}>
              {t('back')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
