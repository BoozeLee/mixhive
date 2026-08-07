import React from 'react';
import { colors, fontSize, fontWeight, transition } from '@/styles/tokens';
import { getGenreColor } from '@/styles/tokens';
import { BpmChip } from '@/components/BpmChip';
import { WaveformAccent } from '@/components/WaveformAccent';

// Interactive hexagonal cell for Hive Composer and Hive Story.
// Always a <button> unless disabled (aria-disabled div). Flat-top orientation.

export type HexVariant = 'track' | 'suggestion' | 'gap' | 'add' | 'chapter';
export type HexSize = 'sm' | 'md' | 'lg';

const SIZES: Record<HexSize, { w: number; h: number; pad: string }> = {
  sm: { w: 64, h: 74, pad: '6px 8px' },
  md: { w: 120, h: 138, pad: '10px 12px' },
  lg: { w: 180, h: 208, pad: '12px 16px' },
};

export interface HexCellProps {
  variant: HexVariant;
  size?: HexSize;
  title?: string;
  artist?: string;
  genre?: string;
  bpm?: number;
  duration?: string;
  similarity?: number;
  keyCamelot?: string;
  playing?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onDismiss?: () => void;
  // chapter-specific
  icon?: React.ReactNode;
  date?: string;
  label?: string;
}

function variantBorder(variant: HexVariant, selected?: boolean): string {
  if (selected) return `2px solid ${colors.accent}`;
  switch (variant) {
    case 'track':
      return `1px solid ${colors.border}`;
    case 'suggestion':
      return `2px dashed ${colors.accent}`;
    case 'gap':
      return `2px dashed ${colors.border}`;
    case 'add':
      return `1px solid ${colors.borderStrong}`;
    case 'chapter':
      return `1px solid ${colors.border}`;
  }
}

function variantBackground(variant: HexVariant, selected?: boolean): string {
  if (selected) return colors.accentFaint;
  switch (variant) {
    case 'track':
      return colors.surface;
    case 'chapter':
      return colors.surface;
    default:
      return 'transparent';
  }
}

export function HexCell({
  variant,
  size = 'md',
  title,
  artist,
  genre,
  bpm,
  duration,
  similarity,
  keyCamelot,
  playing = false,
  selected = false,
  disabled = false,
  onClick,
  onDismiss,
  icon,
  date,
  label,
}: HexCellProps) {
  const { w, h, pad } = SIZES[size];
  const genreColor = getGenreColor(genre);
  const bg = variantBackground(variant, selected);
  const border = variantBorder(variant, selected);

  const hexStyle: React.CSSProperties = {
    position: 'relative',
    width: w,
    height: h,
    clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
    background: bg,
    border,
    padding: pad,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.3 : 1,
    transition: `transform ${transition.fast}, border-color ${transition.fast}`,
    outline: 'none',
    boxSizing: 'border-box',
    overflow: 'hidden',
    textAlign: 'center',
    flexShrink: 0,
  };

  const innerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    overflow: 'hidden',
  };

  // Genre accent strip — applied on inner div (not outer, which has clip-path)
  const accentStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: '20%',
    bottom: '20%',
    width: 3,
    background: genreColor,
    borderRadius: 4,
    opacity: genre ? 1 : 0,
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled) {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.borderColor = colors.accent;
    }
  };
  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled) {
      e.currentTarget.style.transform = '';
      e.currentTarget.style.borderColor = '';
    }
  };

  const innerContent = (
    <div style={innerStyle}>
      <div style={accentStyle} />

      {variant === 'add' && (
        <span style={{ fontSize: 24, color: colors.text.muted, lineHeight: 1 }}>+</span>
      )}

      {variant === 'chapter' && (
        <>
          {icon && <span style={{ fontSize: size === 'lg' ? 20 : 14, lineHeight: 1 }}>{icon}</span>}
          {size !== 'sm' && label && (
            <span
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
                color: colors.text.primary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '90%',
              }}
            >
              {label}
            </span>
          )}
          {date && <span style={{ fontSize: fontSize.xs, color: colors.text.dim }}>{date}</span>}
        </>
      )}

      {(variant === 'track' || variant === 'suggestion') && (
        <>
          {playing && <WaveformAccent playing bars={8} seedId={title} />}
          {title && (
            <span
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
                color: colors.text.primary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '90%',
              }}
            >
              {title}
            </span>
          )}
          {artist && size !== 'sm' && (
            <span
              style={{
                fontSize: fontSize.xs,
                color: colors.text.muted,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '90%',
              }}
            >
              {artist}
            </span>
          )}
          {size !== 'sm' && (bpm || duration || keyCamelot) && (
            <div
              style={{
                display: 'flex',
                gap: 4,
                alignItems: 'center',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              {bpm && <BpmChip bpm={bpm} size="sm" />}
              {keyCamelot && (
                <span
                  style={{
                    fontSize: fontSize.xs,
                    fontFamily: 'monospace',
                    color: colors.text.muted,
                    background: `${colors.border}`,
                    padding: '1px 4px',
                    borderRadius: 4,
                    lineHeight: 1.4,
                  }}
                >
                  {keyCamelot}
                </span>
              )}
              {duration && (
                <span style={{ fontSize: fontSize.xs, color: colors.text.dim }}>{duration}</span>
              )}
            </div>
          )}
          {variant === 'suggestion' && similarity !== undefined && size !== 'sm' && (
            <span
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                fontSize: fontSize.xs,
                color:
                  similarity >= 0.8
                    ? colors.accent
                    : similarity >= 0.6
                      ? colors.text.muted
                      : colors.text.dim,
                fontWeight: fontWeight.semibold,
              }}
            >
              ↑ {Math.round(similarity * 100)}%
            </span>
          )}
        </>
      )}

      {variant === 'gap' && size !== 'sm' && (
        <span style={{ fontSize: fontSize.xs, color: colors.text.dim }}>BPM gap</span>
      )}
    </div>
  );

  if (disabled) {
    return (
      <div style={hexStyle} role="presentation">
        {innerContent}
      </div>
    );
  }

  const ariaLabel =
    variant === 'suggestion'
      ? `Suggestion: ${title ?? ''} — ${Math.round((similarity ?? 0) * 100)}% vibe match`
      : variant === 'chapter'
        ? `${label ?? ''} ${date ?? ''}`
        : `${title ?? ''} by ${artist ?? ''}${bpm ? `, BPM ${bpm}` : ''}`;

  return (
    <button
      type="button"
      style={hexStyle}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-label={ariaLabel}
      aria-pressed={selected}
      role={variant === 'suggestion' ? 'option' : 'button'}
    >
      {innerContent}
      {variant === 'suggestion' && onDismiss && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onDismiss();
          }}
          aria-label="Dismiss suggestion"
          style={{
            position: 'absolute',
            top: 2,
            left: 4,
            background: 'none',
            border: 'none',
            color: colors.text.dim,
            cursor: 'pointer',
            fontSize: 11,
            padding: 2,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </button>
  );
}
