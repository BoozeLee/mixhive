'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { colors, fontSize, radius, withAlpha } from '../styles/tokens';
import { supabase } from '../lib/supabase';

const BETA_KEY = 'mixhive_beta';

export function isBetaUser(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(BETA_KEY) === 'true';
}

export function BetaGate({ children }: { children: React.ReactNode }) {
  const t = useTranslations('beta');
  const [beta, setBeta] = useState(false);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setBeta(isBetaUser());
  }, []);

  const handleRedeem = async () => {
    if (!code.trim() || redeeming) return;
    setRedeeming(true);
    setError('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError(t('invalidCode'));
        return;
      }
      const res = await fetch('/api/beta/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t('invalidCode'));
        return;
      }
      localStorage.setItem(BETA_KEY, 'true');
      setBeta(true);
      setSuccess(true);
    } catch {
      setError(t('invalidCode'));
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div>
      {beta || success ? (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            background: withAlpha(colors.successStrong, 0.1),
            border: `1px solid ${withAlpha(colors.successStrong, 0.3)}`,
            borderRadius: radius.md,
            fontSize: fontSize.sm,
            color: colors.successStrong,
          }}
        >
          <span style={{ fontWeight: 600 }}>{t('statusActive')}</span>
        </div>
      ) : (
        <div
          style={{
            padding: 16,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.lg,
            maxWidth: 400,
          }}
        >
          <p style={{ fontSize: fontSize.sm, fontWeight: 600, color: colors.text.primary, marginBottom: 8 }}>
            {t('joinTitle')}
          </p>
          <p style={{ fontSize: fontSize.xs, color: colors.text.dim, marginBottom: 12 }}>
            {t('joinDescription')}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder={t('codePlaceholder')}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: colors.surfaceRaised,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                color: colors.text.primary,
                fontSize: fontSize.sm,
              }}
            />
            <button
              onClick={handleRedeem}
              disabled={redeeming || !code.trim()}
              style={{
                padding: '8px 16px',
                background: colors.accentBright,
                color: colors.black,
                border: 'none',
                borderRadius: radius.md,
                fontSize: fontSize.sm,
                fontWeight: 600,
                cursor: redeeming || !code.trim() ? 'not-allowed' : 'pointer',
                opacity: redeeming || !code.trim() ? 0.5 : 1,
              }}
            >
              {redeeming ? t('redeeming') : t('redeem')}
            </button>
          </div>
          {error && (
            <p style={{ fontSize: fontSize.xs, color: colors.dangerStrong, marginTop: 8 }}>
              {error}
            </p>
          )}
        </div>
      )}
      {!beta && !success && children}
    </div>
  );
}
