import React from 'react';
import { colors, radius, fontSize } from '@/styles/tokens';

interface KeyChipProps {
  keyCamelot: string;
  compatible?: boolean;
}

export function KeyChip({ keyCamelot, compatible }: KeyChipProps) {
  let borderColor = colors.border;
  if (compatible === true) borderColor = colors.success;
  if (compatible === false) borderColor = colors.warning;

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 6px',
        borderRadius: radius.sm,
        fontSize: fontSize.xs,
        fontFamily: 'monospace',
        fontVariantNumeric: 'tabular-nums',
        background: colors.surfaceHover,
        border: `1px solid ${borderColor}`,
        color: colors.text.secondary,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      {keyCamelot}
    </span>
  );
}
