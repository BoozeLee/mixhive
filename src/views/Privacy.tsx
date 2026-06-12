'use client';

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
  return (
    <div style={wrap}>
      <h1 style={h1}>Privacy Policy</h1>
      <p style={{ ...p, color: colors.text.dim }}>Last updated 2026-06-09 · Policy version v1</p>

      <h2 style={h2}>Who we are</h2>
      <p style={p}>
        MixHive is a social platform for DJs, producers and underground music creators. This policy
        explains what personal data we process and your rights under the GDPR (and equivalent laws
        such as LGPD, APPI and PIPA).
      </p>

      <h2 style={h2}>Data we process</h2>
      <p style={p}>
        Account data (email, profile, links), content you upload (mixes, playlists, comments),
        social graph (follows, messages), and limited technical data (consent records, basic logs).
        Analytics are only collected if you opt in via the cookie banner.
      </p>

      <h2 style={h2}>Legal bases</h2>
      <p style={p}>
        We rely on contract (to provide the service), consent (for optional analytics/marketing),
        and legitimate interest (security and abuse prevention).
      </p>

      <h2 style={h2}>Your rights</h2>
      <p style={p}>
        You can access and export your data, and request deletion, from Settings → Privacy &amp;
        Data. Deletion is processed within a 30-day window. You may withdraw analytics consent at
        any time via the cookie banner.
      </p>

      <h2 style={h2}>Contact</h2>
      <p style={p}>
        For privacy requests, contact the MixHive team via your account settings. Localized
        (DE/ES/etc.) versions of this policy will accompany regional launches.
      </p>
    </div>
  );
}
