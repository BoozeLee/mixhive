'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { colors, fontSize, fontWeight, radius, space } from '../../styles/tokens';
import { Textarea } from '../ui/Textarea';

export const ART_STYLES = [
  'cyber-hive',
  'cinematic',
  'neon',
  'abstract',
  'minimal',
  'cyberpunk',
  'anime',
  'photorealistic',
] as const;

export type ArtStyle = (typeof ART_STYLES)[number];

export const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '3:2', '2:3'] as const;

export interface ArtPromptState {
  prompt: string;
  negativePrompt: string;
  style: ArtStyle;
  aspectRatio: string;
  denoisingStrength: number;
  qualityDetail: boolean;
  qualitySharpness: boolean;
  qualityCinematic: boolean;
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: space[3],
        padding: '8px 14px',
        minHeight: 40,
        borderRadius: radius.pill,
        border: `1px solid ${active ? colors.accent : colors.border}`,
        background: active ? colors.accentFaint : colors.surface,
        color: active ? colors.accent : colors.text.secondary,
        fontSize: fontSize.sm,
        fontWeight: active ? fontWeight.semibold : fontWeight.medium,
        cursor: 'pointer',
        textTransform: 'capitalize',
      }}
    >
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: space[7] }}>
      <div
        style={{
          fontSize: fontSize.xs,
          color: colors.text.dim,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: space[4],
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[3] }}>{children}</div>
    </div>
  );
}

export function PromptEditor({
  value,
  onChange,
}: {
  value: ArtPromptState;
  onChange: (v: ArtPromptState) => void;
}) {
  const t = useTranslations('artStudio');
  const [showNegative, setShowNegative] = useState(false);
  const [showBoosters, setShowBoosters] = useState(false);

  const set = <K extends keyof ArtPromptState>(k: K, v: ArtPromptState[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div style={{ display: 'grid', gap: space[6] }}>
      <div>
        <label
          style={{
            fontSize: fontSize.xs,
            color: colors.text.dim,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            display: 'block',
            marginBottom: space[3],
          }}
        >
          {t('promptLabel')}
        </label>
        <Textarea
          value={value.prompt}
          onChange={e => set('prompt', e.target.value)}
          placeholder={t('promptPlaceholder')}
          rows={3}
        />
        <div
          style={{
            fontSize: fontSize.xs,
            color: colors.text.faint,
            marginTop: space[2],
          }}
        >
          {t('promptHint')}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowNegative(s => !s)}
        style={{
          background: 'none',
          border: 'none',
          color: colors.text.dim,
          fontSize: fontSize.sm,
          cursor: 'pointer',
          padding: 0,
          textAlign: 'left',
        }}
      >
        {showNegative ? '−' : '+'} {t('negativePrompt')}
      </button>
      {showNegative && (
        <Textarea
          value={value.negativePrompt}
          onChange={e => set('negativePrompt', e.target.value)}
          placeholder={t('negativePlaceholder')}
          rows={2}
        />
      )}

      <Field label={t('style')}>
        {ART_STYLES.map(s => (
          <Chip key={s} label={s} active={value.style === s} onClick={() => set('style', s)} />
        ))}
      </Field>

      <Field label={t('aspectRatio')}>
        {ASPECT_RATIOS.map(r => (
          <Chip
            key={r}
            label={r}
            active={value.aspectRatio === r}
            onClick={() => set('aspectRatio', r)}
          />
        ))}
      </Field>

      <div>
        <div
          style={{
            fontSize: fontSize.xs,
            color: colors.text.dim,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: space[3],
          }}
        >
          {t('denoising')}: {value.denoisingStrength.toFixed(2)}
        </div>
        <input
          type="range"
          min={0.3}
          max={1}
          step={0.05}
          value={value.denoisingStrength}
          onChange={e => set('denoisingStrength', Number(e.target.value))}
          style={{ width: '100%', maxWidth: 420, accentColor: colors.accent }}
          aria-label={t('denoising')}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            maxWidth: 420,
            fontSize: fontSize.xs,
            color: colors.text.faint,
          }}
        >
          <span>{t('closerToRef')}</span>
          <span>{t('moreCreative')}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowBoosters(s => !s)}
        style={{
          background: 'none',
          border: 'none',
          color: colors.text.dim,
          fontSize: fontSize.sm,
          cursor: 'pointer',
          padding: 0,
          textAlign: 'left',
        }}
      >
        {showBoosters ? '−' : '+'} {t('qualityBoosters')}
      </button>
      {showBoosters && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[4], maxWidth: 360 }}>
          {(
            [
              ['qualityDetail', t('detail')],
              ['qualitySharpness', t('sharpness')],
              ['qualityCinematic', t('cinematicBoost')],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: fontSize.sm,
                color: colors.text.secondary,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={value[key]}
                onChange={e => set(key, e.target.checked)}
                style={{ width: 18, height: 18, accentColor: colors.accent }}
              />
              {label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
