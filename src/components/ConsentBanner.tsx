'use client';

import { useState, useEffect } from 'react';
import { colors, fontSize, radius } from '../styles/tokens';
import { consentDecided, saveConsent } from '../lib/consent';

export function ConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(!consentDecided());
  }, []);

  if (!show) return null;

  const decide = async (analytics: boolean) => {
    await saveConsent({ analytics, marketing: false });
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
      aria-label="Cookie consent"
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
      <p style={{ color: colors.text.secondary, fontSize: fontSize.sm, margin: 0 }}>
        We use necessary cookies to run MixHive, and optional analytics to improve it. Read our{' '}
        <a href="/cookies" style={{ color: colors.text.primary }}>Cookie Policy</a> and{' '}
        <a href="/privacy" style={{ color: colors.text.primary }}>Privacy Policy</a>.
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button onClick={() => decide(true)} style={btn(colors.success, '#000')}>
          Accept analytics
        </button>
        <button onClick={() => decide(false)} style={btn('transparent', colors.text.secondary)}>
          Reject non-essential
        </button>
      </div>
    </div>
  );
}
