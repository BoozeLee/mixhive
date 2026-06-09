'use client';

import { colors, fontSize } from '../styles/tokens';

const wrap = { maxWidth: 760, margin: '0 auto', padding: 24, color: colors.text.secondary } as const;
const h1 = { fontSize: fontSize['3xl'], fontWeight: 700, color: colors.text.primary } as const;
const h2 = { fontSize: fontSize.lg, fontWeight: 600, color: colors.text.primary, marginTop: 24 } as const;
const p = { fontSize: fontSize.sm, lineHeight: 1.6, marginTop: 8 } as const;

export function Terms() {
  return (
    <div style={wrap}>
      <h1 style={h1}>Terms of Service</h1>
      <p style={{ ...p, color: colors.text.dim }}>Last updated 2026-06-09</p>

      <h2 style={h2}>Acceptable use</h2>
      <p style={p}>You agree to upload only content you have the rights to share, to respect other creators, and to follow the community guidelines. Abuse, harassment, and infringement may result in removal or account suspension.</p>

      <h2 style={h2}>Your content</h2>
      <p style={p}>You retain ownership of the mixes and material you publish. You grant MixHive a limited licence to host and display your content so the platform can function.</p>

      <h2 style={h2}>Marketplace &amp; payments</h2>
      <p style={p}>Gear and agent marketplace transactions are processed via Stripe; escrow and payout terms are shown at the point of sale.</p>

      <h2 style={h2}>Changes</h2>
      <p style={p}>We may update these terms; material changes will be communicated in-app.</p>
    </div>
  );
}
