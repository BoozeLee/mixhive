import React from 'react';
import { colors, genreColors, radius, fontSize } from '@/styles/tokens';

interface BpmChipProps {
  bpm: number;
  size?: 'sm' | 'md';
}

function bpmColor(bpm: number): string {
  if (bpm <= 100) return colors.info;
  if (bpm <= 130) return colors.accent;
  return genreColors.dnb; // hsl(82, 80%, 48%) — acid green
}

export function BpmChip({ bpm, size = 'md' }: BpmChipProps) {
  const c = bpmColor(bpm);
  const pad = size === 'sm' ? '1px 6px' : '2px 8px';
  const fs = size === 'sm' ? fontSize.xs : fontSize.sm;

  return (
    <span
      style={{
        display: 'inline-block',
        padding: pad,
        borderRadius: radius.pill,
        fontSize: fs,
        fontVariantNumeric: 'tabular-nums',
        fontFamily: 'monospace',
        background: `${c}26`,
        border: `1px solid ${c}66`,
        color: c,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      {bpm} BPM
    </span>
  );
}
