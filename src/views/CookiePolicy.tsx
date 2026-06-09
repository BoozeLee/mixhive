'use client';

import { colors, fontSize } from '../styles/tokens';

const wrap = { maxWidth: 760, margin: '0 auto', padding: 24, color: colors.text.secondary } as const;
const h1 = { fontSize: fontSize['3xl'], fontWeight: 700, color: colors.text.primary } as const;
const h2 = { fontSize: fontSize.lg, fontWeight: 600, color: colors.text.primary, marginTop: 24 } as const;
const p = { fontSize: fontSize.sm, lineHeight: 1.6, marginTop: 8 } as const;

export function CookiePolicy() {
  return (
    <div style={wrap}>
      <h1 style={h1}>Cookie Policy</h1>
      <p style={{ ...p, color: colors.text.dim }}>Last updated 2026-06-09</p>

      <h2 style={h2}>Necessary</h2>
      <p style={p}>Required to sign you in, keep your session, and run core features. These are always on.</p>

      <h2 style={h2}>Analytics (optional)</h2>
      <p style={p}>If you accept analytics, we use privacy-respecting product analytics to understand usage and improve MixHive. These are only loaded after you opt in via the consent banner.</p>

      <h2 style={h2}>Managing your choice</h2>
      <p style={p}>Your consent is stored on this device and recorded against your account if you are signed in. Clearing site data resets the banner so you can choose again.</p>
    </div>
  );
}
