'use client';

import { useCallback, useState } from 'react';
import { colors, fontSize, fontWeight, radius, space, transition } from '@/styles/tokens';
import { HiveButton } from '@/components/hive/HiveButton';
import type { FlowSpore, GerminationTarget } from '@/lib/rituals';

const TARGETS: Array<{ value: GerminationTarget; label: string; hint: string }> = [
  { value: 'mixhive_session', label: 'New ritual', hint: 'Open it again as a live room' },
  { value: 'mix_draft', label: 'Mix draft', hint: 'Start a release from it' },
  { value: 'beehive', label: 'Beehive', hint: 'Carry it into the desktop studio' },
];

/** Two-tone hex: carbon (the humans) left, silica (the machine) right. */
function FractionHex({ carbon, silica }: { carbon: number; silica: number }) {
  const total = carbon + silica;
  const silicaShare = total === 0 ? 0 : silica / total;
  return (
    <svg width={40} height={40} viewBox="0 0 100 100" aria-hidden="true" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="spore-fraction" x1="0" x2="1" y1="0" y2="0">
          <stop offset={`${(1 - silicaShare) * 100}%`} stopColor={colors.accent} />
          <stop offset={`${(1 - silicaShare) * 100}%`} stopColor={colors.accentCyan} />
        </linearGradient>
      </defs>
      <polygon
        points="25,2 75,2 98,50 75,98 25,98 2,50"
        fill="url(#spore-fraction)"
        stroke={colors.borderStrong}
        strokeWidth={4}
      />
    </svg>
  );
}

export interface SporeCardProps {
  spore: FlowSpore;
  onGerminate: (sporeId: string, target: GerminationTarget) => Promise<void>;
  /** Absent when the viewer has no wallet available to sign with. */
  onCountersign?: (sporeId: string) => Promise<void>;
}

export function SporeCard({ spore, onGerminate, onCountersign }: SporeCardProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signing, setSigning] = useState(false);
  const [copied, setCopied] = useState(false);

  const shortHash = spore.content_hash ? spore.content_hash.slice(0, 12) : 'unsealed';

  const copyHash = useCallback(async () => {
    if (!spore.content_hash) return;
    try {
      await navigator.clipboard.writeText(spore.content_hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the hash is visible either way.
    }
  }, [spore.content_hash]);

  const germinate = useCallback(
    async (target: GerminationTarget) => {
      setBusy(true);
      try {
        await onGerminate(spore.id, target);
        setOpen(false);
      } finally {
        setBusy(false);
      }
    },
    [onGerminate, spore.id]
  );

  return (
    <article
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.lg,
        padding: space[8],
        display: 'flex',
        flexDirection: 'column',
        gap: space[6],
        transition: `border-color ${transition.fast}`,
      }}
    >
      <div style={{ display: 'flex', gap: space[6], alignItems: 'center', minWidth: 0 }}>
        <FractionHex carbon={spore.carbon_count} silica={spore.silica_count} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: fontSize.md,
              fontWeight: fontWeight.bold,
              color: colors.text.primary,
            }}
          >
            {spore.generation === 0 ? 'Drained from a ritual' : `Generation ${spore.generation}`}
          </div>
          <div style={{ fontSize: fontSize.xs, color: colors.text.muted }}>
            {spore.capped_count} of {spore.capped_count + spore.skipped_count} cells capped
            {spore.germination_count > 0 && ` · grown ${spore.germination_count}×`}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: space[4], flexWrap: 'wrap', alignItems: 'center' }}>
        <span
          style={{
            fontSize: fontSize.xs,
            color: colors.text.dim,
            border: `1px solid ${colors.borderSubtle}`,
            borderRadius: radius.sm,
            padding: `${space[1]}px ${space[4]}px`,
          }}
        >
          {spore.carbon_count} human{spore.carbon_count === 1 ? '' : 's'}
          {spore.silica_count > 0 && ` · ${spore.silica_count} machine`}
        </span>
        <button
          type="button"
          onClick={() => void copyHash()}
          disabled={!spore.content_hash}
          aria-label={
            spore.content_hash ? `Copy genome hash ${spore.content_hash}` : 'No genome hash yet'
          }
          style={{
            fontSize: fontSize.xs,
            fontFamily: 'monospace',
            color: colors.text.dim,
            background: 'transparent',
            border: `1px solid ${colors.borderSubtle}`,
            borderRadius: radius.sm,
            padding: `${space[1]}px ${space[4]}px`,
            cursor: spore.content_hash ? 'pointer' : 'default',
          }}
        >
          {copied ? 'copied' : shortHash}
        </button>
      </div>

      {/* Layers B and C: who has vouched for this with their own key, and
          whether it sits under a published notary root. Both are stated
          plainly rather than badged — a proof that needs explaining is not a
          proof anyone will trust. */}
      <div style={{ display: 'flex', gap: space[4], flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: fontSize.xs, color: colors.text.dim }}>
          {spore.countersigned_count === 0
            ? 'nobody has signed for this yet'
            : `${spore.countersigned_count} of ${spore.carbon_count} signed for it`}
          {spore.i_countersigned && ' · including you'}
        </span>
        <span
          style={{
            fontSize: fontSize.xs,
            color: spore.anchor ? colors.accent : colors.text.faint,
          }}
          title={spore.anchor ? `Merkle root ${spore.anchor.merkle_root}` : undefined}
        >
          {spore.anchor
            ? `notarised ${spore.anchor.batch_date}${spore.anchor.chain ? ` · ${spore.anchor.chain}` : ''}`
            : 'sealed, not yet notarised'}
        </span>
      </div>

      {spore.can_countersign && onCountersign && (
        <HiveButton
          variant="glass"
          size="sm"
          loading={signing}
          onClick={() => {
            setSigning(true);
            void onCountersign(spore.id).finally(() => setSigning(false));
          }}
        >
          Sign that you were there
        </HiveButton>
      )}

      {!open ? (
        <HiveButton variant="ghost" size="sm" onClick={() => setOpen(true)}>
          Germinate
        </HiveButton>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
          <div style={{ fontSize: fontSize.xs, color: colors.text.muted }}>Grow it into…</div>
          {TARGETS.map(t => (
            <HiveButton
              key={t.value}
              variant="glass"
              size="sm"
              loading={busy}
              onClick={() => void germinate(t.value)}
            >
              {t.label} — {t.hint}
            </HiveButton>
          ))}
          <HiveButton variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Not now
          </HiveButton>
        </div>
      )}
    </article>
  );
}
